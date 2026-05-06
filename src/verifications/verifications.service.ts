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
import { PhLtoDriversLicenseDto } from './dto/ph-lto-drivers-license.dto';
import { PhNationalPoliceDto } from './dto/ph-national-police.dto';
import { PhNbiDto } from './dto/ph-nbi.dto';
import { PhPrcDto } from './dto/ph-prc.dto';
import { PhSssDto } from './dto/ph-sss.dto';
import { BiometricsFaceMatchDto } from './dto/biometrics-face-match.dto';
import { BiometricsRegistrationDto } from './dto/biometrics-registration.dto';
import { BiometricVerificationDto } from './dto/biometric-verification.dto';
import { CustomDocumentDto } from './dto/custom-document.dto';
import { FinalizeVerificationDto } from './dto/finalize-verification.dto';
import { ManualFinalizeVerificationDto } from './dto/manual-finalize-verification.dto';
import { IDmetaProvider } from '../providers/implementations/idmeta/idmeta.provider';
import { EventPublisher } from '../websocket/event-publisher.service';
import { FileStorageService } from '../common/file-storage.service';

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
    private readonly fileStorageService: FileStorageService,
  ) {}

  async createVerification(tenantId: string, createVerificationDto: CreateVerificationDto) {
    try {
      // 1. Link to existing account if accountId is provided
      // Note: Account creation/saving is now handled ONLY after finalize-verification when status is 'verified'
      let account: Account | null = null;
      
      if (createVerificationDto.accountId) {
        account = await this.accountRepository.findOne({
          where: { id: createVerificationDto.accountId, tenant_id: tenantId },
        });
        
        if (!account) {
          throw new BadRequestException(`Account with ID ${createVerificationDto.accountId} not found`);
        }
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
      // Note: account_id will be set after finalize-verification when account is created/saved
      const verification = this.verificationRepository.create({
        tenant_id: tenantId,
        provider_id: providerEntity.id,
        account_id: account?.id || null, // Link to existing account if provided, otherwise null (will be set after finalize-verification)
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
      const result = await providerInstance.createVerification(request);

      // Extract verification types from plans if available
      let verificationTypes: string[] = null;
      let mainVerificationType = verification.verification_type;
      
      if (result.providerData?.plans && Array.isArray(result.providerData.plans)) {
        verificationTypes = result.providerData.plans
          .map((plan: any) => plan.plan)
          .filter((plan: string) => plan && typeof plan === 'string');
        
        // Update main verification_type to first extracted type or 'multi' if multiple types
        if (verificationTypes.length > 0) {
          mainVerificationType = verificationTypes.length === 1 ? verificationTypes[0] : 'multi';
        }
      }

      // 6. Update verification with provider response
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

  /**
   * Server-side proxy for the IDMeta PhilSys SDK validate-verification step.
   * The browser SDK can't do this call directly because IDMeta blocks
   * cross-origin requests. We perform it here and hand the resulting eVerify
   * publicKey back to the CLIENT, which then drives the eVerify liveness SDK
   * directly (no CORS — eVerify runs on its own origin).
   */
  async validatePhilsysVerification(tenantId: string, verificationId: string): Promise<{ publicKey: string }> {
    const verification = await this.getVerification(verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('PH PhilSys validate is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first.');
    }

    return providerInstance.validatePhilsysVerification(verification.external_verification_id);
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

    // 4) Account saving is now handled only after finalize-verification when status is 'verified'
    // Do not update account here - verification status is 'processing' until finalized

    // 5) Publish websocket update
    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return { id: verification.id, status: result.status };
  }

  async runDocumentVerification(
    tenantId: string,
    params: { verificationId: string; templateId: string; imageFrontSide: string; imageBackSide?: string }
  ) {
    // 1) Load verification and provider
    const verification = await this.getVerification(params.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('Document verification is only supported for IDmeta provider in this flow');
    }

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

    // Ensure we have the provider's external verification id
    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    // Emit progress
    await this.eventPublisher.publishProgress(verification.id, 'document_verification', 20);

    // Save images to file system with step type prefix
    const stepType = 'document_verification';
    const frontImageInfo = await this.fileStorageService.saveBase64Image(
      params.imageFrontSide,
      verification.id,
      `${stepType}-front`
    );
    
    let backImageInfo = null;
    if (params.imageBackSide) {
      backImageInfo = await this.fileStorageService.saveBase64Image(
        params.imageBackSide,
        verification.id,
        `${stepType}-back`
      );
    }

    // 2) Call IDmeta Document Verification
    const result = await providerInstance.verifyDocument({
      imageFrontSide: params.imageFrontSide,
      imageBackSide: params.imageBackSide,
      templateId: params.templateId,
      verificationId: verification.external_verification_id,
    });

    // Store image URLs and metadata organized by step type (stepType already defined above)
    const imagesMetadata = {
      front: {
        url: frontImageInfo.url,
        mimeType: frontImageInfo.mimeType,
        size: frontImageInfo.size,
      },
      ...(backImageInfo && {
        back: {
          url: backImageInfo.url,
          mimeType: backImageInfo.mimeType,
          size: backImageInfo.size,
        },
      }),
    };

    // Preserve existing verification steps and add/update this step
    const existingMetadata = verification.metadata || {};
    const existingSteps = existingMetadata.verification_steps || {};

    // 3) Update verification with latest status and provider data
    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
      validated_user_data: result.providerData?.parsedResult?.data ?? result.providerData?.parsedResult,
      metadata: ({
        ...existingMetadata,
        request_type: stepType, // Current step type
        verification_steps: {
          ...existingSteps,
          [stepType]: {
            images: imagesMetadata,
            completedAt: new Date().toISOString(),
          },
        },
      } as any),
      updated_at: new Date(),
    });

    // 4) Account saving is now handled only after finalize-verification when status is 'verified'
    // Do not update account here - verification status is 'processing' until finalized

    // 5) Publish websocket update
    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return { id: verification.id, status: result.status };
  }

  async verifyPhLtoDriversLicense(tenantId: string, dto: PhLtoDriversLicenseDto) {
    // 1) Load verification and provider
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('PH LTO Drivers License is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    await this.eventPublisher.publishProgress(verification.id, 'ph_lto_verification', 25);

    const result = await providerInstance.verifyPhLtoDriversLicense({
      licenseNo: dto.licenseNo,
      templateId: dto.templateId,
      verificationId: verification.external_verification_id,
    });

    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
      validated_user_data: result.providerData?.parsedResult?.data,
      metadata: ({
        ...(verification.user_metadata || verification.metadata || {}),
        request_type: 'ph_lto_drivers_license',
        country: 'PH',
        flow: 'government_data',
        license_no: dto.licenseNo,
      } as any),
    });

    // Account saving is now handled only after finalize-verification when status is 'verified'
    // Do not update account here - verification status is 'processing' until finalized

    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return { id: verification.id, status: result.status };
  }

  async verifyPhNationalPolice(tenantId: string, dto: PhNationalPoliceDto) {
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('PH National Police is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    await this.eventPublisher.publishProgress(verification.id, 'ph_national_police_verification', 25);

    const result = await providerInstance.verifyPhNationalPolice({
      surname: dto.surname,
      clearanceNo: dto.clearanceNo,
      templateId: dto.templateId,
      verificationId: verification.external_verification_id,
    });

    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
      validated_user_data: result.providerData?.parsedResult?.data,
      metadata: ({
        ...(verification.user_metadata || verification.metadata || {}),
        request_type: 'ph_national_police',
        country: 'PH',
        flow: 'government_data',
        clearance_no: dto.clearanceNo,
        surname: dto.surname,
      } as any),
    });

    // Account saving is now handled only after finalize-verification when status is 'verified'
    // Do not update account here - verification status is 'processing' until finalized

    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return { id: verification.id, status: result.status };
  }

  async verifyPhNbi(tenantId: string, dto: PhNbiDto) {
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('PH NBI is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    await this.eventPublisher.publishProgress(verification.id, 'ph_nbi_verification', 25);

    const result = await providerInstance.verifyPhNbi({
      clearanceNo: dto.clearanceNo,
      templateId: dto.templateId,
      verificationId: verification.external_verification_id,
    });

    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
      validated_user_data: result.providerData?.parsedResult?.data,
      metadata: ({
        ...(verification.user_metadata || verification.metadata || {}),
        request_type: 'ph_nbi',
        country: 'PH',
        flow: 'government_data',
        clearance_no: dto.clearanceNo,
      } as any),
    });

    // Account saving is now handled only after finalize-verification when status is 'verified'
    // Do not update account here - verification status is 'processing' until finalized

    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return { id: verification.id, status: result.status };
  }

  async verifyPhPrc(tenantId: string, dto: PhPrcDto) {
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('PH PRC is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    // Validate that either license-based or name-based search parameters are provided
    if (!(dto.licenseNo && dto.dateOfBirth) && !(dto.firstName && dto.lastName)) {
      throw new BadRequestException('Either (licenseNo and dateOfBirth) or (firstName and lastName) must be provided');
    }

    await this.eventPublisher.publishProgress(verification.id, 'ph_prc_verification', 25);

    const result = await providerInstance.verifyPhPrc({
      profession: dto.profession,
      licenseNo: dto.licenseNo,
      dateOfBirth: dto.dateOfBirth,
      firstName: dto.firstName,
      lastName: dto.lastName,
      templateId: dto.templateId,
      verificationId: verification.external_verification_id,
    });

    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
      validated_user_data: result.providerData?.parsedResult?.data,
      metadata: ({
        ...(verification.user_metadata || verification.metadata || {}),
        request_type: 'ph_prc',
        country: 'PH',
        flow: 'government_data',
        profession: dto.profession,
        search_type: dto.licenseNo ? 'license' : 'name',
      } as any),
    });

    // Account saving is now handled only after finalize-verification when status is 'verified'
    // Do not update account here - verification status is 'processing' until finalized

    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return { id: verification.id, status: result.status };
  }

  async verifyPhSss(tenantId: string, dto: PhSssDto) {
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('PH SSS is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    await this.eventPublisher.publishProgress(verification.id, 'ph_sss_verification', 25);

    const result = await providerInstance.verifyPhSss({
      crnSsNumber: dto.crnSsNumber,
      templateId: dto.templateId,
      verificationId: verification.external_verification_id,
    });

    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
      validated_user_data: result.providerData?.parsedResult?.data,
      metadata: ({
        ...(verification.user_metadata || verification.metadata || {}),
        request_type: 'ph_sss',
        country: 'PH',
        flow: 'government_data',
        crn_ss_number: dto.crnSsNumber,
      } as any),
    });

    // Account saving is now handled only after finalize-verification when status is 'verified'
    // Do not update account here - verification status is 'processing' until finalized

    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return { id: verification.id, status: result.status };
  }

  async biometricsFaceMatch(tenantId: string, dto: BiometricsFaceMatchDto) {
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('Biometrics Face Match is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    await this.eventPublisher.publishProgress(verification.id, 'biometrics_face_match', 25);

    // Save images to file system with step type prefix
    const stepType = 'biometrics_face_match';
    const image1Info = await this.fileStorageService.saveBase64Image(
      dto.image1,
      verification.id,
      `${stepType}-image1`
    );
    const image2Info = await this.fileStorageService.saveBase64Image(
      dto.image2,
      verification.id,
      `${stepType}-image2`
    );

    const result = await providerInstance.biometricsFaceMatch({
      image1: dto.image1,
      image2: dto.image2,
      templateId: dto.templateId,
      verificationId: verification.external_verification_id,
    });

    // Store image URLs and metadata organized by step type (stepType already defined above)
    const imagesMetadata = {
      image1: {
        url: image1Info.url,
        mimeType: image1Info.mimeType,
        size: image1Info.size,
      },
      image2: {
        url: image2Info.url,
        mimeType: image2Info.mimeType,
        size: image2Info.size,
      },
    };

    // Preserve existing verification steps and add/update this step
    const existingMetadata = verification.metadata || {};
    const existingSteps = existingMetadata.verification_steps || {};
    
    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
      validated_user_data: result.providerData?.result,
      metadata: ({
        ...existingMetadata,
        request_type: stepType, // Current step type
        flow: 'compliance',
        score: result.providerData?.score,
        verification_steps: {
          ...existingSteps,
          [stepType]: {
            images: imagesMetadata,
            score: result.providerData?.score,
            completedAt: new Date().toISOString(),
          },
        },
      } as any),
    });

    // Account saving is now handled only after finalize-verification when status is 'verified'
    // Do not update account here - verification status is 'processing' until finalized

    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return { id: verification.id, status: result.status };
  }

  async biometricsRegistration(tenantId: string, dto: BiometricsRegistrationDto) {
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('Biometrics Registration is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    await this.eventPublisher.publishProgress(verification.id, 'biometrics_registration', 25);

    // Save image to file system with step type prefix
    const stepType = 'biometrics_registration';
    const imageInfo = await this.fileStorageService.saveBase64Image(
      dto.image,
      verification.id,
      `${stepType}-image`
    );

    const result = await providerInstance.biometricsRegistration({
      username: dto.username,
      image: dto.image,
      templateId: dto.templateId,
      verificationId: verification.external_verification_id,
    });

    // Store image URL and metadata organized by step type (stepType already defined above)
    const imageMetadata = {
      url: imageInfo.url,
      mimeType: imageInfo.mimeType,
      size: imageInfo.size,
    };

    // Preserve existing verification steps and add/update this step
    const existingMetadata = verification.metadata || {};
    const existingSteps = existingMetadata.verification_steps || {};

    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
      validated_user_data: result.providerData?.result,
      metadata: ({
        ...existingMetadata,
        request_type: stepType, // Current step type
        flow: 'compliance',
        username: dto.username,
        faceId: result.providerData?.result?.result?.faceId,
        verification_steps: {
          ...existingSteps,
          [stepType]: {
            image: imageMetadata,
            username: dto.username,
            faceId: result.providerData?.result?.result?.faceId,
            completedAt: new Date().toISOString(),
          },
        },
      } as any),
    });

    // Account saving is now handled only after finalize-verification when status is 'verified'
    // Do not update account here - verification status is 'processing' until finalized

    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return { id: verification.id, status: result.status };
  }

  async customDocument(tenantId: string, dto: CustomDocumentDto) {
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('Custom Document verification is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    await this.eventPublisher.publishProgress(verification.id, 'custom_document', 25);

    // Save document image to file system with step type prefix if provided
    const stepType = 'custom_document';
    let documentInfo = null;
    if (dto.document) {
      documentInfo = await this.fileStorageService.saveBase64Image(
        dto.document,
        verification.id,
        `${stepType}-document`
      );
    }

    const result = await providerInstance.customDocument({
      document: dto.document,
      templateId: dto.templateId,
      verificationId: verification.external_verification_id,
    });

    // Store document URL and metadata organized by step type (stepType already defined above)
    const documentMetadata = documentInfo ? {
      url: documentInfo.url,
      mimeType: documentInfo.mimeType,
      size: documentInfo.size,
    } : null;

    // Preserve existing verification steps and add/update this step
    const existingMetadata = verification.metadata || {};
    const existingSteps = existingMetadata.verification_steps || {};

    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
      validated_user_data: result.providerData?.formData,
      metadata: ({
        ...existingMetadata,
        request_type: stepType, // Current step type
        flow: 'customize',
        verification_steps: {
          ...existingSteps,
          [stepType]: {
            ...(documentMetadata && { document: documentMetadata }),
            formData: result.providerData?.formData,
            completedAt: new Date().toISOString(),
          },
        },
      } as any),
    });

    // Account saving is now handled only after finalize-verification when status is 'verified'
    // Do not update account here - verification status is 'processing' until finalized

    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return { id: verification.id, status: result.status };
  }

  async biometricVerification(tenantId: string, dto: BiometricVerificationDto) {
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('Biometric Verification is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    await this.eventPublisher.publishProgress(verification.id, 'biometric_verification', 25);

    // Save image to file system with step type prefix (prefer image over imageBase64)
    const stepType = 'biometric_verification';
    let imageInfo = null;
    if (dto.image) {
      imageInfo = await this.fileStorageService.saveBase64Image(
        dto.image,
        verification.id,
        `${stepType}-image`
      );
    } else if (dto.imageBase64) {
      // Convert plain base64 to data URI format
      const dataUri = `data:image/jpeg;base64,${dto.imageBase64}`;
      imageInfo = await this.fileStorageService.saveBase64Image(
        dataUri,
        verification.id,
        `${stepType}-image`
      );
    }

    const result = await providerInstance.biometricVerification({
      image: dto.image,
      imageBase64: dto.imageBase64,
      templateId: dto.templateId,
      verificationId: verification.external_verification_id,
    });

    // Store image URL and metadata organized by step type (stepType already defined above)
    const imageMetadata = imageInfo ? {
      url: imageInfo.url,
      mimeType: imageInfo.mimeType,
      size: imageInfo.size,
    } : null;

    // Preserve existing verification steps and add/update this step
    const existingMetadata = verification.metadata || {};
    const existingSteps = existingMetadata.verification_steps || {};

    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
      validated_user_data: result.providerData?.result,
      metadata: ({
        ...existingMetadata,
        request_type: stepType, // Current step type
        flow: 'compliance',
        probability: result.providerData?.probability,
        faceId: result.providerData?.faceId,
        verification_steps: {
          ...existingSteps,
          [stepType]: {
            ...(imageMetadata && { image: imageMetadata }),
            probability: result.providerData?.probability,
            faceId: result.providerData?.faceId,
            completedAt: new Date().toISOString(),
          },
        },
      } as any),
    });

    // Account saving is now handled only after finalize-verification when status is 'verified'
    // Do not update account here - verification status is 'processing' until finalized

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

    // Extract images from metadata - aggregate all verification steps
    const metadata = verification.metadata || {};
    const verificationSteps = metadata.verification_steps || {};
    
    // Build images object with all steps
    const allImages: Record<string, any> = {};
    
    // Add images from each verification step
    Object.keys(verificationSteps).forEach(stepType => {
      const step = verificationSteps[stepType];
      if (step.images) {
        // Multiple images (e.g., face match, document verification)
        allImages[stepType] = { images: step.images };
      } else if (step.image) {
        // Single image (e.g., registration, verification)
        allImages[stepType] = { image: step.image };
      } else if (step.document) {
        // Custom document
        allImages[stepType] = { document: step.document };
      }
    });

    // For backward compatibility, also include current step's images at root level
    const currentStepImages = metadata.images || metadata.image || metadata.document ? {
      ...(metadata.images && { images: metadata.images }),
      ...(metadata.image && { image: metadata.image }),
      ...(metadata.document && { document: metadata.document }),
    } : null;

    return {
      ...verification,
      result,
      images: Object.keys(allImages).length > 0 ? allImages : currentStepImages, // Include all images organized by step
      verificationSteps: verificationSteps, // Include full step information
      requestType: metadata.request_type, // Most recent step type
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
    
    // Extract images from metadata - aggregate all verification steps
    const metadata = verification.metadata || {};
    const verificationSteps = metadata.verification_steps || {};
    
    // Build images object with all steps
    const allImages: Record<string, any> = {};
    
    // Add images from each verification step
    Object.keys(verificationSteps).forEach(stepType => {
      const step = verificationSteps[stepType];
      if (step.images) {
        // Multiple images (e.g., face match, document verification)
        allImages[stepType] = { images: step.images };
      } else if (step.image) {
        // Single image (e.g., registration, verification)
        allImages[stepType] = { image: step.image };
      } else if (step.document) {
        // Custom document
        allImages[stepType] = { document: step.document };
      }
    });

    // For backward compatibility, also include current step's images at root level
    const currentStepImages = metadata.images || metadata.image || metadata.document ? {
      ...(metadata.images && { images: metadata.images }),
      ...(metadata.image && { image: metadata.image }),
      ...(metadata.document && { document: metadata.document }),
    } : null;
    
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
      images: Object.keys(allImages).length > 0 ? allImages : currentStepImages, // All images organized by step
      verificationSteps: verificationSteps, // Full step information with timestamps
      requestType: metadata.request_type, // Most recent step type
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

      // Account saving is now handled only after finalize-verification when status is 'verified'
      // Do not update account here - verification status is 'processing' until finalized

      // Broadcast WebSocket update
      await this.eventPublisher.publishCompleted(verification.id, result.status as any, result.result);

    } catch (error) {
      this.logger.error('Failed to process single-step verification', error);
      
      await this.verificationRepository.update(verification.id, {
        status: 'rejected',
        provider_response: { error: error.message },
      });

      // Account saving is now handled only after finalize-verification when status is 'verified'
      // Do not update account here on error - verification failed

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
        return account;
      }
    }

    // Create new account
    const account = this.accountRepository.create({
      tenant_id: tenantId,
      email: data.email,
      phone: data.phone,
      metadata: data.metadata,
      verification_status: 'unverified',
    });

    return this.accountRepository.save(account);
  }

  async finalizeVerification(tenantId: string, dto: FinalizeVerificationDto) {
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('Finalize Verification is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    await this.eventPublisher.publishProgress(verification.id, 'finalize_verification', 50);

    const result = await providerInstance.finalizeVerification({
      templateId: dto.templateId,
      verificationId: verification.external_verification_id, // Use external ID from verification
    });

    // Update verification with final status
    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
    });

    // Reload verification to get updated data
    const reloadedVerification = await this.verificationRepository.findOne({
      where: { id: verification.id },
    });

    // Save/update account ONLY if status is 'verified'
    if (result.status === 'verified') {
      await this.saveAccountFromVerification(tenantId, reloadedVerification);
    }

    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return {
      id: verification.id,
      status: result.status,
      finalized: result.providerData.finalized,
      statusMessage: result.providerData.status_message,
      missingPlans: result.providerData.missing_plans,
    };
  }

  async manualFinalizeVerification(tenantId: string, dto: ManualFinalizeVerificationDto) {
    const verification = await this.getVerification(dto.verificationId, tenantId);
    const { providerInstance, providerEntity, assignment } = await this.getProviderForTenant(tenantId);

    if (!(providerInstance instanceof IDmetaProvider)) {
      throw new BadRequestException('Manual Finalize Verification is only supported for IDmeta provider');
    }

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

    if (!verification.external_verification_id) {
      throw new BadRequestException('Verification is not initialized with IDmeta. Initiate a session first to obtain external_verification_id.');
    }

    await this.eventPublisher.publishProgress(verification.id, 'manual_finalize_verification', 50);

    const result = await providerInstance.manualFinalizeVerification({
      templateId: dto.templateId,
      verificationId: verification.external_verification_id, // Use external ID from verification
    });

    // Update verification with final status
    await this.verificationRepository.update(verification.id, {
      status: result.status as any,
      provider_response: result.providerData,
    });

    // Reload verification to get updated data
    const reloadedVerification = await this.verificationRepository.findOne({
      where: { id: verification.id },
    });

    // Save/update account ONLY if status is 'verified'
    if (result.status === 'verified') {
      await this.saveAccountFromVerification(tenantId, reloadedVerification);
    }

    try {
      await this.eventPublisher.publishCompleted(verification.id, result.status, result.providerData);
    } catch (e) {
      this.logger.warn(`Failed to publish websocket event for verification ${verification.id}: ${e.message}`);
    }

    return {
      id: verification.id,
      status: result.status,
      finalized: result.providerData.finalized,
      statusMessage: result.providerData.status_message,
      missingPlans: result.providerData.missing_plans,
    };
  }

  /**
   * Save or update account from verified verification
   * This is called ONLY after finalize-verification when status is 'verified'
   * Extracts user data from verification and properly maps to account entity
   */
  private async saveAccountFromVerification(
    tenantId: string,
    verification: any
  ): Promise<void> {
    try {
      // Only save account if verification status is 'verified'
      if (verification.status !== 'verified') {
        return;
      }

      // Extract user data from multiple sources
      const validatedUserData = verification.validated_user_data || {};
      const providerResponse = verification.provider_response || {};
      const userMetadata = verification.user_metadata || {};
      
      // Only check if account_id is already linked to this verification
      // Otherwise, always create a new account (even if email/phone might be duplicates)
      // Note: Email/phone may not be populated, so we don't use them to find existing accounts
      let account = verification.account_id 
        ? await this.accountRepository.findOne({ where: { id: verification.account_id } })
        : null;

      // Create new account if not already linked
      // We always create a new account even if email/phone duplicates exist elsewhere
      if (!account) {
        account = this.accountRepository.create({
          tenant_id: tenantId,
          email: verification.user_email,
          phone: verification.user_phone,
          metadata: userMetadata,
          verification_status: 'verified',
        });
      } else {
      }

      // Extract identity data from multiple possible structures
      const identityData = validatedUserData?.identity || 
                         validatedUserData?.person ||
                         providerResponse?.identity || 
                         providerResponse?.person ||
                         providerResponse?.parsedResult?.person ||
                         providerResponse?.parsedResult?.data ||
                         providerResponse?.verification?.person ||
                         providerResponse?.fullResponse?.person ||
                         userMetadata?.identity ||
                         {};

      // Extract document data
      const documentData = validatedUserData?.document || 
                         providerResponse?.document ||
                         providerResponse?.documentDetails ||
                         providerResponse?.parsedResult?.document ||
                         providerResponse?.verification?.document ||
                         {};

      // Build verified_data object
      const verifiedData: Record<string, any> = {
        ...validatedUserData,
        ...providerResponse,
        providerResponse,
        verificationId: verification.id,
        externalVerificationId: verification.external_verification_id,
        verifiedAt: new Date().toISOString(),
      };

      // Update account with verified data
      account.verification_status = 'verified';
      account.last_verification_id = verification.id;
      account.verified_data = verifiedData;

      // Update name (extract from various possible fields)
      const firstName = identityData.firstName || identityData.first_name || identityData.first || 
                       validatedUserData?.first_name || providerResponse?.first_name || '';
      const middleName = identityData.middleName || identityData.middle_name || identityData.middle || 
                        validatedUserData?.middle_name || providerResponse?.middle_name || '';
      const lastName = identityData.lastName || identityData.last_name || identityData.last || 
                      validatedUserData?.last_name || providerResponse?.last_name || '';

      if (firstName || lastName) {
        account.name = {
          first: firstName,
          middle: middleName,
          last: lastName,
        };
      }

      // Update email (always update from verification if available - verification is source of truth)
      if (verification.user_email || identityData.email || providerResponse?.email) {
        account.email = verification.user_email || identityData.email || providerResponse?.email || account.email;
      }

      // Update phone (always update from verification if available - verification is source of truth)
      if (verification.user_phone || identityData.phone || identityData.phoneNumber || providerResponse?.phone) {
        account.phone = verification.user_phone || identityData.phone || identityData.phoneNumber || providerResponse?.phone || account.phone;
      }

      // Update birthdate (always update from verification if available - verification is source of truth)
      const dob = identityData.dateOfBirth || identityData.date_of_birth || identityData.birthdate || 
                 validatedUserData?.birth_date || validatedUserData?.date_of_birth || 
                 providerResponse?.date_of_birth || providerResponse?.birth_date;
      if (dob) {
        account.birthdate = new Date(dob);
      }

      // Update address (always update from verification if available - verification is source of truth)
      const addressData = identityData.address || validatedUserData?.address || providerResponse?.address;
      if (addressData) {
        account.address = {
          street: addressData.street || addressData.streetAddress || addressData.address_line1 || account.address?.street || '',
          city: addressData.city || addressData.city_name || account.address?.city || '',
          state: addressData.state || addressData.stateProvince || addressData.province || account.address?.state || '',
          country: addressData.country || addressData.countryCode || addressData.country_name || account.address?.country || '',
          postalCode: addressData.postalCode || addressData.postCode || addressData.zipCode || addressData.zip || account.address?.postalCode || '',
        };
      }

      // Store document information in metadata
      if (documentData && Object.keys(documentData).length > 0) {
        if (!account.metadata) {
          account.metadata = {};
        }
        account.metadata.verifiedDocument = {
          ...documentData,
          verifiedAt: new Date().toISOString(),
        };
      }

      // Merge additional metadata
      if (userMetadata && Object.keys(userMetadata).length > 0) {
        if (!account.metadata) {
          account.metadata = {};
        }
        account.metadata = {
          ...account.metadata,
          ...userMetadata,
          lastVerifiedAt: new Date().toISOString(),
        };
      }

      // Save account
      await this.accountRepository.save(account);

      // Link account to verification if not already linked
      if (verification.account_id !== account.id) {
        await this.verificationRepository.update(verification.id, {
          account_id: account.id,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to save account from verification ${verification.id}:`, error);
      throw error;
    }
  }

  // Helper method to update account status after verification (deprecated - use saveAccountFromVerification instead)
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
      status === 'approved' || status === 'verified' ? 'verified' :
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
  }
}
