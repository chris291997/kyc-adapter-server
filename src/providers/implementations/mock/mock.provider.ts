import { Injectable, Logger } from '@nestjs/common';
import { IKycProvider, ProviderType, ProcessingMethod, ProviderCredentials, ProviderConfig, ProviderCapabilities, VerificationRequest, VerificationResponse, VerificationStatusResponse, WebhookResult, ProviderHealthResponse } from '../../interfaces/kyc-provider.interface';

@Injectable()
export class MockProvider implements IKycProvider {
  private readonly logger = new Logger(MockProvider.name);
  
  readonly name = 'Mock Provider';
  readonly type = ProviderType.SINGLE_STEP;
  readonly isInitialized = true;
  
  readonly capabilities: ProviderCapabilities = {
    supportsDocumentVerification: true,
    supportedDocumentTypes: ['all'],
    supportedCountries: ['all'],
    supportsFaceVerification: true,
    supportsLiveness: true,
    supportsFaceMatch: true,
    supportsBiometrics: false,
    supportsFingerprintVerification: false,
    supportsAML: true,
    supportsPEP: true,
    supportsSanctionsScreening: true,
    supportsAddressVerification: false,
    supportsWebhooks: false,
    supportsMultiStep: false,
    supportsHostedWorkflow: false,
    supportsPolling: true,
    supportsRealTimeUpdates: false,
    averageProcessingTime: 5,
    maxFileSize: 10485760, // 10MB
    supportedImageFormats: ['jpg', 'png', 'pdf'],
  };

  async initialize(credentials: ProviderCredentials, config?: ProviderConfig): Promise<void> {
    this.logger.log('Mock provider initialized (no-op)');
  }

  async createVerification(request: VerificationRequest): Promise<VerificationResponse> {
    // Simulate processing delay
    await this.delay(2000);

    // Return mock result (80% success rate)
    const isSuccess = Math.random() > 0.2;
    
    return {
      id: request.verificationId,
      providerVerificationId: `mock-${this.generateId()}`,
      status: isSuccess ? 'approved' : 'rejected',
      result: this.generateMockResult(isSuccess),
      processingMethod: ProcessingMethod.DIRECT,
    };
  }

  async getVerificationStatus(verificationId: string): Promise<VerificationStatusResponse> {
    return {
      id: verificationId,
      status: 'approved',
      result: this.generateMockResult(true),
    };
  }

  async cancelVerification(verificationId: string): Promise<boolean> {
    this.logger.log(`Mock cancellation for verification: ${verificationId}`);
    return true;
  }

  async handleWebhook(payload: unknown, signature?: string): Promise<WebhookResult> {
    throw new Error('Mock provider does not support webhooks');
  }

  async healthCheck(): Promise<ProviderHealthResponse> {
    return {
      isHealthy: true,
      latency: 10,
    };
  }

  private generateMockResult(isSuccess: boolean): any {
    if (!isSuccess) {
      return {
        overall: {
          status: 'rejected',
          confidence: 45.2,
        },
        rejection_reason: 'Document authenticity check failed',
      };
    }

    return {
      overall: {
        status: 'approved',
        confidence: 95.5,
      },
      document: {
        type: 'passport',
        number: 'P1234567',
        country: 'US',
        expiryDate: '2030-01-01',
      },
      person: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
      },
      checks: {
        documentAuthenticity: 'passed',
        faceMatch: 'passed',
        liveness: 'passed',
        aml: 'cleared',
      },
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


