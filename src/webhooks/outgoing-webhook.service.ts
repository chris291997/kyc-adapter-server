import { Injectable, Logger } from '@nestjs/common';
import { Verification } from '../database/entities/verification.entity';
import * as crypto from 'crypto';
import * as axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OutgoingWebhookService {
  private readonly logger = new Logger(OutgoingWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
  ) {}

  /**
   * Send webhook to client's callback URL (if provided during verification initiation)
   * This is the adapter sending updates to the client's system
   */
  async sendWebhook(
    verification: Verification,
    event: string,
    data: any
  ) {
    // Use callback URL from verification (provided by client during initiation)
    if (!verification.callback_url) {
      return;
    }
    
    const payload = {
      event,
      verificationId: verification.id,
      timestamp: new Date().toISOString(),
      data
    };
    
    // Generate signature using system webhook secret
    const webhookSecret = this.configService.get<string>('WEBHOOK_SECRET', 'default-secret-change-me');
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    try {
      const response = await axios.default.post(verification.callback_url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-KYC-Signature': `sha256=${signature}`,
          'X-KYC-Event': event,
          'X-KYC-Verification-ID': verification.id
        },
        timeout: 30000 // 30 second timeout
      });
      
      return { success: true };
      
    } catch (error) {
      this.logger.error(`Webhook delivery failed to ${verification.callback_url}`, error);
      
      // TODO: Implement retry logic with exponential backoff
      await this.queueWebhookRetry(verification, event, data, 1);
      
      return { success: false, error: error.message };
    }
  }

  private async queueWebhookRetry(
    verification: Verification,
    event: string,
    data: any,
    attempt: number
  ) {
    if (attempt > 5) {
      this.logger.error(`Webhook retry limit reached for ${verification.id}`);
      return;
    }
    
    const delay = Math.pow(5, attempt) * 1000; // Exponential backoff
    
    // TODO: Implement queue system for retries
    // Queue integration can enqueue retries here when implemented
  }
}


