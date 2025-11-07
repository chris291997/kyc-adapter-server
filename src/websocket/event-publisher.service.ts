import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../shared/redis.service';

@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);

  constructor(private readonly redisService: RedisService) {}
  
  async publish(event: any) {
    // Validate that verificationId is present
    if (!event.verificationId || typeof event.verificationId !== 'string' || event.verificationId.trim() === '') {
      this.logger.error('Cannot publish event: missing or invalid verificationId', event);
      throw new Error('Event must include a valid verificationId');
    }
    
    await this.redisService.publish(
      'verification-events',
      JSON.stringify(event)
    );
    
  }
  
  async publishProgress(verificationId: string, step: string, progress: number) {
    await this.publish({
      event: 'verification.progress',
      verificationId,
      timestamp: new Date().toISOString(),
      data: {
        step,
        progress,
        message: this.getProgressMessage(step, progress)
      }
    });
  }
  
  async publishCompleted(verificationId: string, status: string, result: any) {
    await this.publish({
      event: 'verification.completed',
      verificationId,
      timestamp: new Date().toISOString(),
      data: {
        status,
        result
      }
    });
  }
  
  async publishError(verificationId: string, error: string) {
    await this.publish({
      event: 'verification.error',
      verificationId,
      timestamp: new Date().toISOString(),
      data: {
        error
      }
    });
  }
  
  private getProgressMessage(step: string, progress: number): string {
    const messages = {
      'document_uploaded': 'Document uploaded successfully',
      'document_processing': 'Analyzing document...',
      'face_verification': 'Verifying face...',
      'liveness_check': 'Performing liveness check...',
      'id_verification': 'Verifying ID against database...',
      'aml_check': 'Running AML checks...',
      'finalizing': 'Finalizing verification...'
    };
    
    return messages[step] || `Processing: ${progress}%`;
  }
}
