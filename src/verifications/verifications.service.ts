import { Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Verification } from '../database/entities/verification.entity';
import { VerificationDocument } from '../database/entities/verification-document.entity';
import { Account } from '../database/entities/account.entity';
import { ProvidersFactory } from '../providers/providers.factory';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { OverrideVerificationDto } from './dto/override-verification.dto';
import { PhilsysPcnDto } from './dto/philsys-pcn.dto';
import { IDmetaProvider } from '../providers/implementations/idmeta/idmeta.provider';
import { EventPublisher } from '../websocket/event-publisher.service';

@Injectable()
export class VerificationsService {
  private readonly logger = new Logger(VerificationsService.name);

  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    @InjectRepository(VerificationDocument)
    private readonly documentRepository: Repository<VerificationDocument>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @Optional() @InjectQueue('verification-processing')
    private readonly verificationQueue: Queue,
    private readonly providersFactory: ProvidersFactory,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async createVerification(tenantId: string, createVerificationDto: CreateVerificationDto) {
    try {
      // 1. Find or create account from verification data
      let account: Account;
      
      if (createVerificationDto.userEmail || createVerificationDto.accountId) {
        account = await this.findOrCreateAccount(tenantId, {
          accountId: createVerificationDto.accountId,
          email: createVerificationDto.userEmail,
          phone: createVerificationDto.userPhone,
          metadata: createVerificationDto.metadata,
        });
        
        // Update account status to pending
        account.verification_status = 'pending';
        await this.accountRepository.save(account);
      }

      // 2. Get tenant's primary provider (with centralized credentials)
      const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

      // 3. Initialize provider with centralized credentials
      if (!providerInstance.isInitialized) {
        await providerInstance.initialize(
          {
            apiKey: providerEntity.api_key,
            secretKey: providerEntity.secret_key,
            webhookSecret: providerEntity.webhook_secret,
            baseUrl: providerEntity.base_url,
            apiVersion: providerEntity.api_version || 'v1',
          },
          {
            timeout: (providerEntity.config as any)?.timeout || 30000,
            retryAttempts: (providerEntity.config as any)?.retryAttempts || 3,
            ...assignment.tenant_overrides, // Apply tenant-specific overrides if any
          }
        );
      }

      // 4. Create internal verification record
      const verification = this.verificationRepository.create({
        tenant_id: tenantId,
        provider_id: providerEntity.id,
        account_id: account?.id,
        verification_type: createVerificationDto.verificationType || 'multi',
        user_email: createVerificationDto.userEmail,
        user_phone: createVerificationDto.userPhone,
        user_metadata: createVerificationDto.metadata,
        callback_url: createVerificationDto.callbackUrl,
        status: 'pending',
      });

      await this.verificationRepository.save(verification);

      // 4. Create verification request
      const request = {
        verificationId: verification.id,
        tenantId,
        userEmail: createVerificationDto.userEmail,
        userPhone: createVerificationDto.userPhone,
        metadata: createVerificationDto.metadata,
        templateId: createVerificationDto.templateId,
        callbackUrl: createVerificationDto.callbackUrl,
      };

      // 5. Call provider
      const apiVersion = providerEntity.api_version || 'v1';
      const endpoint = `${providerEntity.base_url}/${apiVersion}/verification/create-verification`;
      this.logger.log(`Calling provider '${providerEntity.name}' (${providerEntity.type}) for verification`, {
        providerId: providerEntity.id,
        providerName: providerEntity.name,
        baseUrl: providerEntity.base_url,
        apiVersion,
        endpoint,
        verificationId: verification.id,
        templateId: createVerificationDto.templateId,
      });
      
      const result = await providerInstance.createVerification(request);
      
      this.logger.log(`Provider '${providerEntity.name}' responded successfully`, {
        providerVerificationId: result.providerVerificationId,
        status: result.status,
        sessionUrl: result.sessionUrl,
      });

      // Extract verification types from plans if available
      let verificationTypes: string[] = null;
      let mainVerificationType = verification.verification_type;
      
      if (result.providerData?.plans && Array.isArray(result.providerData.plans)) {
        verificationTypes = result.providerData.plans
          .map((plan: any) => plan.plan)
          .filter((plan: string) => plan && typeof plan === 'string');
        
        this.logger.log(`Extracted verification types from plans: ${verificationTypes.join(', ')}`);
        
        // Update main verification_type to first extracted type or 'multi' if multiple types
        if (verificationTypes.length > 0) {
          mainVerificationType = verificationTypes.length === 1 ? verificationTypes[0] : 'multi';
        }
      }

      // 6. Update verification with provider response
      this.logger.log(`Updating verification with external_verification_id: ${result.providerVerificationId}`);
      
      await this.verificationRepository.update(verification.id, {
        external_verification_id: result.providerVerificationId,
        external_workflow_url: result.sessionUrl,
        provider_response: result as any,
        status: result.status as any,
        verification_type: mainVerificationType,
        verification_types: verificationTypes,
      });

      return {
        verificationId: verification.id,
        externalVerificationId: result.providerVerificationId,
        status: result.status,
        sessionUrl: result.sessionUrl,
        statusUrl: `/api/v1/verifications/${verification.id}`,
        websocketChannel: `verification:${verification.id}`,
        expiresAt: result.expiresAt,
      };

    } catch (error) {
      this.logger.error('Failed to create verification', {
        error: error.message,
        stack: error.stack,
        tenantId,
        userEmail: createVerificationDto.userEmail,
      });
      
      // Re-throw known errors as-is
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      // Wrap unknown errors with more context
      const errorMessage = error.message || 'Failed to create verification';
      this.logger.error(`Unknown error: ${errorMessage}`, error.stack);
      throw new BadRequestException(
        errorMessage.includes('No enabled provider') 
          ? 'No provider assigned to tenant. Please assign a provider first.'
          : errorMessage || 'Failed to create verification. Please ensure a provider is assigned to your tenant.'
      );
    }
  }

  async verifyPhilsysPcn(tenantId: string, dto: PhilsysPcnDto) {
    // 1) Load verification and provider
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    // Ensure IDmeta provider
    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('PH Philsys (PCN) is only supported for IDmeta provider');
    }

    // Initialize if needed
    if (!providerInstance.isInitialized) {
      await providerInstance.initialize(
        {
          apiKey: providerEntity.api_key,
          secretKey: providerEntity.secret_key,
          webhookSecret: providerEntity.webhook_secret,
          baseUrl: providerEntity.base_url,
          apiVersion: providerEntity.api_version || 'v1',
        },
        {
          timeout: (providerEntity.config as any)?.timeout || 30000,
          retryAttempts: (providerEntity.config as any)?.retryAttempts || 3,
          ...assignment.tenant_overrides,
        }
      );
    }

    // Emit progress event
    await this.eventPublisher.publishProgress(verification.id, 'philsys_verification', 25);

    // Ensure we have the provider's external verification id (required by IDmeta)
    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    // 2) Call IDmeta Philsys API using provider's verification id
    const result = await providerInstance.verifyPhilsysPcn({
      pcn: dto.pcn,
      faceLivenessSessionId: dto.faceLivenessSessionId,
      templateId: dto.templateId,
      verificationId: verification.external_verification_id,
    });

    // 3) Update verification with latest status and provider data
    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
      validated_user_data: result.providerData?.parsedResult?.data,
      metadata: ({
        ...(verification.user_metadata || verification.metadata || {}),
        request_type: 'philsys_pcn',
        country: 'PH',
        flow: 'philsys',
        input_type: dto.pcn ? 'PCN' : 'UNKNOWN',
      } as any),
    });

    // 4) Update account status if linked
    if (verification.account_id) {
      await this.updateAccountStatus(verification.account_id, result.status as any, verification.id, {
        identity: result.providerData?.parsedResult?.data ? {
          firstName: result.providerData?.parsedResult?.data?.first_name,
          middleName: result.providerData?.parsedResult?.data?.middle_name,
          lastName: result.providerData?.parsedResult?.data?.last_name,
          dateOfBirth: result.providerData?.parsedResult?.data?.birth_date,
        } : undefined,
        document: {
          type: 'philsys_pcn',
          number: dto.pcn,
        },
      });
    }

    // 5) Publish websocket update
    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return { id: verification.id, status: result.status };
  }

  async getVerification(verificationId: string, tenantId?: string) {
    const where: any = { id: verificationId };
    if (tenantId) {
      where.tenant_id = tenantId;
    }

    const verification = await this.verificationRepository.findOne({
      where,
      relations: ['documents', 'provider'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    // Compose a friendly result child for FE mapping
    const result =
      (verification as any).validated_user_data ??
      (verification as any).provider_response?.parsedResult?.data ??
      (verification as any).provider_response?.parsedResult ??
      (verification as any).provider_response?.result ??
      (verification as any).provider_response ??
      null;

    return {
      ...verification,
      result,
    } as any;
  }

  async uploadDocument(verificationId: string, uploadDto: UploadDocumentDto, tenantId: string) {
    const verification = await this.getVerification(verificationId, tenantId);

    if (verification.status !== 'pending') {
      throw new BadRequestException('Cannot upload documents to a verification that is not pending');
    }

    // Create document record
    const document = this.documentRepository.create({
      verification_id: verificationId,
      document_type: uploadDto.documentType as any,
      file_url: uploadDto.fileUrl,
      file_size: uploadDto.fileSize,
      mime_type: uploadDto.mimeType,
      uploaded_at: new Date(),
    });

    await this.documentRepository.save(document);

    // If this is a single-step provider, process immediately
    if (verification.provider.type === 'single_step') {
      await this.processSingleStepVerification(verification);
    }

    return document;
  }

  async overrideVerification(verificationId: string, overrideDto: OverrideVerificationDto, userId: string, tenantId: string) {
    const verification = await this.getVerification(verificationId, tenantId);

    if (!['needs_review', 'rejected'].includes(verification.status)) {
      throw new BadRequestException('Verification cannot be overridden in its current status');
    }

    const originalStatus = verification.status;

    await this.verificationRepository.update(verificationId, {
      status: overrideDto.decision,
      is_overridden: true,
      overridden_by: userId,
      overridden_at: new Date(),
      override_reason: overrideDto.reason,
    });

    // Broadcast WebSocket update
    await this.eventPublisher.publishCompleted(verificationId, overrideDto.decision, {
      is_overridden: true,
      overridden_by: userId,
      override_reason: overrideDto.reason,
      original_status: originalStatus
    });

    return {
      success: true,
      newStatus: overrideDto.decision,
      originalStatus,
    };
  }

  async getVerificationStatus(verificationId: string, tenantId?: string) {
    const verification = await this.getVerification(verificationId, tenantId);
    
    return {
      id: verification.id,
      externalVerificationId: verification.external_verification_id,
      status: verification.status,
      verificationType: verification.verification_type,
      verificationTypes: verification.verification_types,
      result: verification.validated_user_data,
      confidence: verification.confidence_score,
      isOverridden: verification.is_overridden,
      sessionUrl: verification.external_workflow_url,
      createdAt: verification.created_at,
      updatedAt: verification.updated_at,
    };
  }

  private async getProviderForTenant(tenantId: string) {
    // Get tenant's primary provider (with centralized credentials)
    const { assignment, provider: providerEntity } = await this.providersFactory.getPrimaryProviderForTenant(tenantId);
    const providerInstance = await this.providersFactory.getProviderById(providerEntity.id);
    
    return { 
      providerInstance, 
      providerEntity, 
      assignment 
    };
  }

  private async processSingleStepVerification(verification: Verification) {
    try {
      // Update status to processing
      await this.verificationRepository.update(verification.id, {
        status: 'processing',
      });

      // Emit progress event
      await this.eventPublisher.publishProgress(verification.id, 'single_step_verification', 30);

      // Get provider
      const provider = await this.providersFactory.getProviderById(verification.provider_id);
      
      // Get documents
      const documents = await this.documentRepository.find({
        where: { verification_id: verification.id },
      });

      // Process with provider
      const request = {
        verificationId: verification.id,
        tenantId: verification.tenant_id,
        documents: documents.map(doc => ({
          type: doc.document_type,
          data: doc.file_url,
          filename: `${doc.document_type}.${doc.mime_type.split('/')[1]}`,
          mimeType: doc.mime_type,
        })),
      };

      const result = await provider.createVerification(request);

      // Update verification with result
      await this.verificationRepository.update(verification.id, {
        status: result.status as any,
        provider_response: result.result,
        validated_user_data: result.result,
        confidence_score: result.result?.overall?.confidence || 0,
      });

      // Update account status if linked
      if (verification.account_id) {
        await this.updateAccountStatus(verification.account_id, result.status as any, verification.id, result.result);
      }

      // Broadcast WebSocket update
      await this.eventPublisher.publishCompleted(verification.id, result.status as any, result.result);

    } catch (error) {
      this.logger.error('Failed to process single-step verification', error);
      
      await this.verificationRepository.update(verification.id, {
        status: 'rejected',
        provider_response: { error: error.message },
      });

      // Update account status to rejected if linked
      if (verification.account_id) {
        await this.updateAccountStatus(verification.account_id, 'rejected', verification.id);
      }

      // Broadcast WebSocket update for error
      await this.eventPublisher.publishCompleted(verification.id, 'rejected', { error: error.message });
    }
  }

  // Helper method to find or create account
  private async findOrCreateAccount(
    tenantId: string,
    data: { accountId?: string; email?: string; phone?: string; metadata?: Record<string, any> }
  ): Promise<Account> {
    // If accountId is provided, try to find it
    if (data.accountId) {
      const account = await this.accountRepository.findOne({
        where: { id: data.accountId, tenant_id: tenantId },
      });
      
      if (account) {
        return account;
      }
    }

    // Try to find by email
    if (data.email) {
      const account = await this.accountRepository.findOne({
        where: { tenant_id: tenantId, email: data.email },
      });

      if (account) {
        this.logger.log(`Found existing account by email: ${data.email}`);
        return account;
      }
    }

    // Create new account
    this.logger.log(`Creating new account for tenant: ${tenantId}`);
    const account = this.accountRepository.create({
      tenant_id: tenantId,
      email: data.email,
      phone: data.phone,
      metadata: data.metadata,
      verification_status: 'unverified',
    });

    return this.accountRepository.save(account);
  }

  // Helper method to update account status after verification
  private async updateAccountStatus(
    accountId: string,
    status: string,
    verificationId: string,
    verifiedData?: Record<string, any>
  ): Promise<void> {
    const account = await this.accountRepository.findOne({ where: { id: accountId } });
    
    if (!account) {
      this.logger.warn(`Account ${accountId} not found for status update`);
      return;
    }

    // Map verification status to account status
    const accountStatus: 'unverified' | 'pending' | 'verified' | 'rejected' = 
      status === 'approved' ? 'verified' :
      status === 'rejected' ? 'rejected' :
      status === 'pending' || status === 'processing' ? 'pending' :
      'unverified';

    account.verification_status = accountStatus;
    account.last_verification_id = verificationId;

    // Extract and store verified data
    if (verifiedData && accountStatus === 'verified') {
      account.verified_data = verifiedData;
      
      // Auto-populate account fields from verified data if not already set
      if (verifiedData.identity) {
        if (!account.name && (verifiedData.identity.firstName || verifiedData.identity.lastName)) {
          account.name = {
            first: verifiedData.identity.firstName,
            middle: verifiedData.identity.middleName,
            last: verifiedData.identity.lastName,
          };
        }
        if (!account.birthdate && verifiedData.identity.dateOfBirth) {
          account.birthdate = new Date(verifiedData.identity.dateOfBirth);
        }
      }
      
      if (verifiedData.document) {
        if (!account.metadata) {
          account.metadata = {};
        }
        account.metadata.verifiedDocument = verifiedData.document;
      }
    }

    await this.accountRepository.save(account);
    this.logger.log(`Updated account ${accountId} status to ${accountStatus}`);
  }
}
