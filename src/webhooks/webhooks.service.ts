import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookLog } from '../database/entities/webhook-log.entity';
import { Verification } from '../database/entities/verification.entity';
import { Account } from '../database/entities/account.entity';
import { ProvidersFactory } from '../providers/providers.factory';
import { WebhookSignatureService } from './webhook-signature.service';
import { OutgoingWebhookService } from './outgoing-webhook.service';
import { EventPublisher } from '../websocket/event-publisher.service';
import { KYCWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly providersFactory: ProvidersFactory,
    private readonly signatureService: WebhookSignatureService,
    private readonly outgoingWebhookService: OutgoingWebhookService,
    private readonly eventPublisher: EventPublisher,
    private readonly websocketGateway: KYCWebSocketGateway,
  ) {}

  async handleProviderWebhook(
    providerId: string,
    payload: any,
    signature?: string
  ) {
    const startTime = Date.now();
    
    try {
      // 1. Log incoming webhook
      const webhookLog = await this.webhookLogRepository.save({
        provider_id: providerId,
        payload,
        signature,
        status: 'received',
        received_at: new Date(),
      });

      // 2. Get provider entity with centralized credentials
      const providerEntity = await this.providersFactory.getProviderEntityById(providerId);
      if (!providerEntity) {
        throw new NotFoundException(`Provider ${providerId} not found`);
      }

      // 3. Get provider instance
      const provider = await this.providersFactory.getProviderById(providerId);

      // 4. Initialize provider with centralized credentials (always initialize)
      if (!provider.isInitialized) {
        await provider.initialize(
          {
            apiKey: providerEntity.api_key || '',
            secretKey: providerEntity.secret_key || '',
            webhookSecret: providerEntity.webhook_secret,
            baseUrl: providerEntity.base_url,
          },
          {
            timeout: (providerEntity.config as any)?.timeout || 30000,
            retryAttempts: (providerEntity.config as any)?.retryAttempts || 3,
          }
        );
      }

      // 5. Extract tenantId from payload (IDmeta sends it in metadata or nested structure)
      const inferredTenantId = payload?.tenant_id || payload?.metadata?.tenantId || payload?.tenantId;
      if (!inferredTenantId) {
        this.logger.warn('Tenant ID not found in webhook payload');
      }

      // 6. Get webhook secret from provider entity (centralized credentials)
      const webhookSecret = providerEntity.webhook_secret;
      
      if (!webhookSecret) {
        this.logger.warn(`No webhook secret configured for provider ${providerId}`);
      }

      // 7. Verify signature
      if (signature && webhookSecret) {
        const isValid = this.signatureService.verifySignature(
          payload,
          signature,
          webhookSecret
        );
        
        if (!isValid) {
          await this.webhookLogRepository.update(webhookLog.id, {
            status: 'failed',
            error_message: 'Invalid webhook signature',
            processed_at: new Date(),
          });
          throw new Error('Invalid webhook signature');
        }
      }

      // 8. Parse provider-specific payload (provider is now initialized)
      const webhookResult = await provider.handleWebhook(payload, signature);

      // 7. Find internal verification
      const verification = await this.verificationRepository.findOne({
        where: {
          external_verification_id: webhookResult.verificationId,
        },
      });

      if (!verification) {
        throw new NotFoundException('Verification not found');
      }

      // 8. Update verification
      await this.verificationRepository.update(verification.id, {
        status: webhookResult.status as any,
        provider_response: webhookResult.result,
        webhook_received_at: new Date(),
        last_webhook_event: webhookResult.event,
        updated_at: new Date(),
      });

      // Reload verification to get updated data
      const updatedVerification = await this.verificationRepository.findOne({
        where: { id: verification.id },
      });

      // 9. Update account if verification is approved/verified AND account is not already verified
      if (updatedVerification?.account_id && 
          (webhookResult.status === 'approved' || webhookResult.status === 'verified')) {
        await this.updateAccountFromVerification(
          updatedVerification.account_id,
          updatedVerification.id,
          webhookResult.status,
          webhookResult.result,
          updatedVerification.user_metadata,
          updatedVerification.validated_user_data
        );
      }

      // 10. Update webhook log
      await this.webhookLogRepository.update(webhookLog.id, {
        verification_id: verification.id,
        status: 'processed',
        processed_at: new Date(),
      });

      // 11. Broadcast to WebSocket for real-time UI updates
      if (!verification.id) {
        this.logger.error(`⚠️  Cannot publish WebSocket event: verification.id is undefined`, {
          verification: verification,
          webhookResult
        });
      } else {
        const websocketEvent = {
          event: webhookResult.event || 'verification.updated',
          verificationId: verification.id,
          timestamp: new Date().toISOString(),
          data: {
            status: webhookResult.status,
            result: webhookResult.result,
            step: webhookResult.step,
            progress: webhookResult.progress,
            verificationId: verification.id,
            accountId: updatedVerification?.account_id,
          }
        };
        
        try {
          // Publish to Redis (for Redis pub/sub)
          await this.eventPublisher.publish(websocketEvent);
          this.logger.log(`📡 Published to Redis - Event: ${websocketEvent.event}, VerificationId: ${verification.id}`);
          
          // Also broadcast directly to WebSocket (works without Redis)
          await this.websocketGateway.broadcast(verification.id, websocketEvent);
          this.logger.log(`📡 Direct broadcast to WebSocket - Event: ${websocketEvent.event}, VerificationId: ${verification.id}`);
          
          this.logger.debug(`WebSocket Event Payload: ${JSON.stringify(websocketEvent, null, 2)}`);
        } catch (error) {
          this.logger.error(`⚠️  Failed to publish WebSocket event: ${error.message}`, error);
        }
      }

      // 12. Send outgoing webhook to client
      if (verification.callback_url) {
        await this.outgoingWebhookService.sendWebhook(
          verification,
          webhookResult.event || 'verification.updated',
          {
            status: webhookResult.status,
            result: webhookResult.result,
            step: webhookResult.step,
            progress: webhookResult.progress,
          }
        );
      }

      const processingTime = Date.now() - startTime;

      return {
        received: true,
        processingTime,
        verificationId: verification.id,
      };

    } catch (error) {
      this.logger.error('Webhook processing failed', error);
      throw error;
    }
  }

  async getWebhookLogs(providerId?: string, verificationId?: string) {
    const where: any = {};
    if (providerId) where.provider_id = providerId;
    if (verificationId) where.verification_id = verificationId;

    return this.webhookLogRepository.find({
      where,
      order: { received_at: 'DESC' },
      take: 100,
    });
  }

  async replayWebhook(webhookLogId: string) {
    const webhookLog = await this.webhookLogRepository.findOne({
      where: { id: webhookLogId },
    });

    if (!webhookLog) {
      throw new NotFoundException('Webhook log not found');
    }

    return this.handleProviderWebhook(
      webhookLog.provider_id,
      webhookLog.payload,
      webhookLog.signature
    );
  }

  /**
   * Update account status and metadata when verification is approved/verified
   * Only updates if account is not already verified
   */
  private async updateAccountFromVerification(
    accountId: string,
    verificationId: string,
    verificationStatus: string,
    providerResult: any,
    userMetadata?: Record<string, any>,
    validatedUserData?: Record<string, any>
  ): Promise<void> {
    try {
      const account = await this.accountRepository.findOne({
        where: { id: accountId },
      });

      if (!account) {
        this.logger.warn(`Account ${accountId} not found for status update`);
        return;
      }

      // Only update if account is not already verified
      if (account.verification_status === 'verified') {
        this.logger.log(`Account ${accountId} is already verified, skipping status update. Only updating last_verification_id.`);
        // Still update last_verification_id to track the latest verification
        account.last_verification_id = verificationId;
        await this.accountRepository.save(account);
        return;
      }

      // Only proceed if verification is approved/verified
      if (verificationStatus !== 'approved' && verificationStatus !== 'verified') {
        this.logger.log(`Verification ${verificationId} status is ${verificationStatus}, not updating account (only updates on approved/verified)`);
        return;
      }

      // Map verification status to account verification_status
      const accountStatus: 'unverified' | 'pending' | 'verified' | 'rejected' = 'verified';

      // Update account status only if not already verified
      account.verification_status = accountStatus;
      account.last_verification_id = verificationId;
      
      this.logger.log(`Account ${accountId} status updated to ${accountStatus} with verification ${verificationId}`);

      // Extract verified data from multiple sources
      const verifiedData: Record<string, any> = {
        ...validatedUserData,
        ...providerResult,
        providerResult,
        verifiedAt: new Date().toISOString(),
      };

      // Update account with verified data if approved/verified
      if (accountStatus === 'verified') {
        account.verified_data = verifiedData;

        // Extract and populate account fields from verified data
        // Try multiple possible data structures from different providers
        const identityData = validatedUserData?.identity || 
                           providerResult?.identity || 
                           providerResult?.person ||
                           userMetadata?.identity ||
                           {};

        const documentData = validatedUserData?.document || 
                           providerResult?.document ||
                           providerResult?.documentDetails ||
                           {};

        // Update name if available and not already set
        if (!account.name && (identityData.firstName || identityData.first_name || identityData.first)) {
          account.name = {
            first: identityData.firstName || identityData.first_name || identityData.first || '',
            middle: identityData.middleName || identityData.middle_name || identityData.middle || '',
            last: identityData.lastName || identityData.last_name || identityData.last || '',
          };
        }

        // Update birthdate if available and not already set
        if (!account.birthdate && (identityData.dateOfBirth || identityData.date_of_birth || identityData.birthdate)) {
          const dob = identityData.dateOfBirth || identityData.date_of_birth || identityData.birthdate;
          account.birthdate = new Date(dob);
        }

        // Update email if available and not already set (preserve existing email)
        if (!account.email && (identityData.email || userMetadata?.email || providerResult?.email)) {
          account.email = identityData.email || userMetadata?.email || providerResult?.email;
        }
        // Don't overwrite existing email even if new data is available
        // This prevents changing verified emails from previous verifications

        // Update phone if available and not already set (preserve existing phone)
        if (!account.phone && (identityData.phone || identityData.phoneNumber || userMetadata?.phone || providerResult?.phone)) {
          account.phone = identityData.phone || identityData.phoneNumber || userMetadata?.phone || providerResult?.phone;
        }
        // Don't overwrite existing phone even if new data is available

        // Update address if available
        if (identityData.address && !account.address) {
          account.address = {
            street: identityData.address.street || identityData.address.streetAddress || '',
            city: identityData.address.city || '',
            state: identityData.address.state || identityData.address.stateProvince || '',
            country: identityData.address.country || identityData.address.countryCode || '',
            postalCode: identityData.address.postalCode || identityData.address.postCode || identityData.address.zipCode || '',
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

        // Merge additional metadata if provided
        if (userMetadata) {
          if (!account.metadata) {
            account.metadata = {};
          }
          account.metadata = {
            ...account.metadata,
            ...userMetadata,
            lastVerifiedAt: new Date().toISOString(),
          };
        }
      }

      await this.accountRepository.save(account);
      this.logger.log(`Updated account ${accountId} status to ${accountStatus} from verification ${verificationId}`);
    } catch (error) {
      this.logger.error(`Failed to update account ${accountId} from verification`, error);
    }
  }
}
