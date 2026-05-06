import { Injectable, Logger } from '@nestjs/common';
import { IKycProvider, ProviderType, ProcessingMethod, ProviderCredentials, ProviderConfig, ProviderCapabilities, VerificationRequest, VerificationResponse, VerificationStatusResponse, WebhookResult, ProviderHealthResponse } from '../../interfaces/kyc-provider.interface';
import { IDmetaHttpClient } from './idmeta-http.client';
import { IDmetaRequestMapper } from './mappers/idmeta-request.mapper';
import { IDmetaResponseMapper } from './mappers/idmeta-response.mapper';
import {
  VerificationStatus,
  normalizeProviderStatus,
  getLegacyStatusForStorage,
} from '../../../common/verification-status.enum';

@Injectable()
export class IDmetaProvider implements IKycProvider {
  private readonly logger = new Logger(IDmetaProvider.name);
  
  readonly name = 'IDmeta';
  readonly type = ProviderType.MULTI_STEP;
  isInitialized = false;
  
  readonly capabilities: ProviderCapabilities = {
    supportsDocumentVerification: true,
    supportedDocumentTypes: ['passport', 'id_card', 'drivers_license'],
    supportedCountries: ['US', 'UK', 'PH', 'CA', 'AU'],
    supportsFaceVerification: true,
    supportsLiveness: true,
    supportsFaceMatch: true,
    supportsBiometrics: false,
    supportsFingerprintVerification: false,
    supportsAML: true,
    supportsPEP: true,
    supportsSanctionsScreening: true,
    supportsAddressVerification: false,
    supportsWebhooks: true,
    supportsMultiStep: true,
    supportsHostedWorkflow: true,
    supportsPolling: false,
    supportsRealTimeUpdates: true,
    averageProcessingTime: 30,
    maxFileSize: 10485760, // 10MB
    supportedImageFormats: ['jpg', 'png', 'pdf'],
  };

  private credentials: ProviderCredentials;
  private config: ProviderConfig;

  constructor(
    private readonly httpClient: IDmetaHttpClient,
    private readonly requestMapper: IDmetaRequestMapper,
    private readonly responseMapper: IDmetaResponseMapper,
  ) {}

  async initialize(credentials: ProviderCredentials, config?: ProviderConfig): Promise<void> {
    this.credentials = credentials;
    this.config = config || {};
    
    // Initialize HTTP client with credentials
    await this.httpClient.initialize(credentials, config);
    
    this.isInitialized = true;
  }

  async createVerification(request: VerificationRequest): Promise<VerificationResponse> {
    try {
      // Map internal request to IDmeta format
      const idmetaRequest = this.requestMapper.toIDmetaRequest(request);
      
      // Create session with IDmeta
      const session = await this.httpClient.createSession(idmetaRequest);
      
      return {
        id: request.verificationId,
        providerVerificationId: session.verification_id,
        status: 'pending',
        sessionUrl: session.workflow_url,
        expiresAt: new Date(session.expires_at),
        processingMethod: ProcessingMethod.EXTERNAL_LINK,
        providerData: {
          verification: session.verification,
          template: session.template,
          tool_settings: session.tool_settings,
          plans: session.plans,
          fullResponse: session.fullResponse,
        },
      };
    } catch (error) {
      this.logger.error('Failed to create IDmeta verification', error);
      throw error;
    }
  }

  async getVerificationStatus(verificationId: string): Promise<VerificationStatusResponse> {
    try {
      const status = await this.httpClient.getVerificationStatus(verificationId);
      return this.responseMapper.fromIDmetaStatusResponse(status);
    } catch (error) {
      this.logger.error('Failed to get IDmeta verification status', error);
      throw error;
    }
  }

  async cancelVerification(verificationId: string): Promise<boolean> {
    try {
      await this.httpClient.cancelVerification(verificationId);
      return true;
    } catch (error) {
      this.logger.error('Failed to cancel IDmeta verification', error);
      return false;
    }
  }

  async handleWebhook(payload: unknown, signature?: string): Promise<WebhookResult> {
    try {
      // Verify webhook signature using initialized credentials
      if (signature && this.credentials?.webhookSecret) {
        const isValid = this.verifyWebhookSignature(payload, signature, this.credentials.webhookSecret);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      // Parse IDmeta webhook
      const webhookData = payload as any;
      
      return {
        verificationId: webhookData.verification_id,
        status: this.mapStatus(webhookData.status),
        result: this.responseMapper.fromIDmetaWebhookResponse(webhookData),
        event: webhookData.event,
        step: webhookData.step,
        progress: webhookData.progress,
      };
    } catch (error) {
      this.logger.error('Failed to handle IDmeta webhook', error);
      throw error;
    }
  }

  async healthCheck(): Promise<ProviderHealthResponse> {
    try {
      const startTime = Date.now();
      await this.httpClient.healthCheck();
      const latency = Date.now() - startTime;
      
      return {
        isHealthy: true,
        latency,
      };
    } catch (error) {
      this.logger.error('IDmeta health check failed', error);
      return {
        isHealthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute PH Philsys (PCN) verification against IDmeta
   */
  async verifyPhilsysPcn(params: {
    pcn?: string;
    faceLivenessSessionId: string;
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }>{
    const response = await this.httpClient.verifyPhilsys({
      pcn: params.pcn,
      face_liveness_session_id: params.faceLivenessSessionId,
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    // IDmeta may return result as stringified JSON; normalize
    let parsedResult: any = response?.result;
    if (typeof parsedResult === 'string') {
      try { parsedResult = JSON.parse(parsedResult); } catch { /* ignore parse error */ }
    }

    const mappedStatus = this.mapPhilsysStatus(response?.status, response?.status_message, parsedResult);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        parsedResult,
      },
    };
  }

  /**
   * Server-side proxy for the PhilSys SDK's validate-verification call.
   * Returns the eVerify publicKey the CLIENT needs to drive the liveness SDK.
   */
  async validatePhilsysVerification(externalVerificationId: string): Promise<{ publicKey: string }> {
    const response = await this.httpClient.validatePhilsysVerification(externalVerificationId);
    if (response.status !== 'SUCCESS' || !response.publicKey) {
      throw new Error(response.message || 'IDmeta validate-verification did not return a publicKey');
    }
    return { publicKey: response.publicKey };
  }

  /**
   * Execute Document Verification against IDmeta
   */
  async verifyDocument(params: {
    imageFrontSide: string;
    imageBackSide?: string;
    templateId: string;
    verificationId: string; // IDmeta external verification id
  }): Promise<{ status: string; providerData: any }> {
    // HTTP client now handles data URI extraction and FormData conversion
    const response = await this.httpClient.documentVerification({
      imageFrontSide: params.imageFrontSide,
      imageBackSide: params.imageBackSide,
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    // Check if response indicates an extraction failure
    const responseMessage = (response as any)?.message || '';
    const hasExtractionError = responseMessage.toLowerCase().includes('extraction failed') ||
                                responseMessage.toLowerCase().includes('invalid id') ||
                                responseMessage.toLowerCase().includes('document is not valid') ||
                                responseMessage.toLowerCase().includes('must be an image');

    // Normalize various status shapes into our internal statuses
    let rawStatus = (response as any)?.status;
    
    // If IDmeta indicates extraction failed or invalid image, treat as rejected
    if (hasExtractionError) {
      rawStatus = 'rejected';
      this.logger.warn(`IDmeta document extraction failed: ${responseMessage}`);
    } else if (rawStatus === false) {
      // status: false also indicates failure
      rawStatus = 'rejected';
    }
    
    const status = this.mapStatus(
      typeof rawStatus === 'string' ? rawStatus : rawStatus === true ? 'completed' : 'processing'
    );

    // Some providers return nested result structures
    const providerData = {
      fullResponse: response,
      parsedResult: (response as any)?.result ?? response,
      extractionError: hasExtractionError ? responseMessage : undefined,
    };

    return { status, providerData };
  }

  /**
   * Execute PH LTO Drivers License verification against IDmeta
   */
  async verifyPhLtoDriversLicense(params: {
    licenseNo: string;
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }> {
    const response = await this.httpClient.verifyPhLtoDriversLicense({
      licenseNo: params.licenseNo,
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    let parsedResult: any = response?.result;
    if (typeof parsedResult === 'string') {
      try { parsedResult = JSON.parse(parsedResult); } catch { /* ignore parse error */ }
    }

    const mappedStatus = this.mapGovernmentDataStatus(response?.status, response?.status_message, parsedResult);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        parsedResult,
      },
    };
  }

  /**
   * Execute PH National Police verification against IDmeta
   */
  async verifyPhNationalPolice(params: {
    surname: string;
    clearanceNo: string;
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }> {
    const response = await this.httpClient.verifyPhNationalPolice({
      surname: params.surname,
      clearanceNo: params.clearanceNo,
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    let parsedResult: any = response?.result;
    if (typeof parsedResult === 'string') {
      try { parsedResult = JSON.parse(parsedResult); } catch { /* ignore parse error */ }
    }

    const mappedStatus = this.mapGovernmentDataStatus(response?.status, response?.status_message, parsedResult);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        parsedResult,
      },
    };
  }

  /**
   * Execute PH NBI verification against IDmeta
   */
  async verifyPhNbi(params: {
    clearanceNo: string;
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }> {
    const response = await this.httpClient.verifyPhNbi({
      clearanceNo: params.clearanceNo,
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    let parsedResult: any = response?.result;
    if (typeof parsedResult === 'string') {
      try { parsedResult = JSON.parse(parsedResult); } catch { /* ignore parse error */ }
    }

    const mappedStatus = this.mapGovernmentDataStatus(response?.status, response?.status_message, parsedResult);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        parsedResult,
      },
    };
  }

  /**
   * Execute PH PRC verification against IDmeta
   */
  async verifyPhPrc(params: {
    profession: string;
    licenseNo?: string;
    dateOfBirth?: string;
    firstName?: string;
    lastName?: string;
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }> {
    const response = await this.httpClient.verifyPhPrc({
      profession: params.profession,
      licenseNo: params.licenseNo,
      dateOfBirth: params.dateOfBirth,
      firstName: params.firstName,
      lastName: params.lastName,
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    let parsedResult: any = response?.result;
    if (typeof parsedResult === 'string') {
      try { parsedResult = JSON.parse(parsedResult); } catch { /* ignore parse error */ }
    }

    const mappedStatus = this.mapGovernmentDataStatus(response?.status, response?.status_message, parsedResult);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        parsedResult,
      },
    };
  }

  /**
   * Execute PH SSS verification against IDmeta
   */
  async verifyPhSss(params: {
    crnSsNumber: string;
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }> {
    const response = await this.httpClient.verifyPhSss({
      crnSsNumber: params.crnSsNumber,
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    let parsedResult: any = response?.result;
    if (typeof parsedResult === 'string') {
      try { parsedResult = JSON.parse(parsedResult); } catch { /* ignore parse error */ }
    }

    const mappedStatus = this.mapGovernmentDataStatus(response?.status, response?.status_message, parsedResult);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        parsedResult,
      },
    };
  }

  private mapPhilsysStatus(statusCode: number, statusMessage: string, result: any): string {
    // Use common status enum to normalize provider-specific status
    const numericStatus = normalizeProviderStatus(statusCode, statusMessage, {
      providerName: 'IDmeta',
      result,
    });

    // Convert back to legacy string format for backward compatibility with database
    return getLegacyStatusForStorage(numericStatus);
  }

  private mapGovernmentDataStatus(status: number | string, statusMessage?: string, result?: any): string {
    // Use common status enum to normalize provider-specific status
    const numericStatus = normalizeProviderStatus(status, statusMessage, {
      providerName: 'IDmeta',
      result,
    });

    // Convert back to legacy string format for backward compatibility with database
    return getLegacyStatusForStorage(numericStatus);
  }

  private mapBiometricsStatus(status: boolean, result?: any): string {
    // Use common status enum to normalize provider-specific status
    // For async biometrics operations, we should rely on webhooks for final status
    // If the API call succeeds (status === true), return 'processing' and wait for webhook
    // Only return 'rejected' immediately if there's a clear error
    
    const numericStatus = normalizeProviderStatus(status, undefined, {
      providerName: 'IDmeta',
      result,
    });

    // Convert back to legacy string format for backward compatibility with database
    return getLegacyStatusForStorage(numericStatus);
  }

  async biometricsFaceMatch(params: {
    image1: string;
    image2: string;
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }> {
    const response = await this.httpClient.biometricsFaceCompare({
      image1: params.image1,
      image2: params.image2,
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    const mappedStatus = this.mapBiometricsStatus(response.status, response.result);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        result: response.result,
        score: response.result?.score,
      },
    };
  }

  async biometricsRegistration(params: {
    username: string;
    image: string;
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }> {
    const response = await this.httpClient.biometricsRegistration({
      username: params.username,
      image: params.image,
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    const mappedStatus = this.mapBiometricsStatus(response.status, response.result);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        result: response.result,
        apiRequest: response.apiRequest,
      },
    };
  }

  async customDocument(params: {
    document?: string;
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }> {
    const response = await this.httpClient.customDocument({
      document: params.document,
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    // Custom document returns status: true/false
    // Use common status enum to normalize provider-specific status
    const numericStatus = normalizeProviderStatus(response.status, undefined, {
      providerName: 'IDmeta',
      result: response.result,
    });
    const mappedStatus = getLegacyStatusForStorage(numericStatus);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        result: response.result,
        formData: response.result?.formData,
      },
    };
  }

  async biometricVerification(params: {
    image?: string;
    imageBase64?: string;
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }> {
    const response = await this.httpClient.biometricVerification({
      image: params.image,
      image_base64: params.imageBase64,
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    const mappedStatus = this.mapBiometricsStatus(response.status, response.result);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        result: response.result,
        apiRequest: response.apiRequest,
        probability: response.result?.probability,
        faceId: response.result?.faceId,
      },
    };
  }

  async finalizeVerification(params: {
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }> {
    const response = await this.httpClient.finalizeVerification({
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    // Map status from IDmeta response (status: number, status_message: string)
    // Pass isFinalized: true to allow VERIFIED status
    const numericStatus = normalizeProviderStatus(
      response.status,
      response.status_message,
      {
        providerName: 'IDmeta',
        result: response.verification,
        isFinalized: true, // This is a finalize call, so allow VERIFIED status
      }
    );
    const mappedStatus = getLegacyStatusForStorage(numericStatus);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        verification: response.verification,
        missing_plans: response.missing_plans,
        status_message: response.status_message,
        finalized: response.finalized,
      },
    };
  }

  async manualFinalizeVerification(params: {
    templateId: string;
    verificationId: string;
  }): Promise<{ status: string; providerData: any }> {
    const response = await this.httpClient.manualFinalizeVerification({
      template_id: params.templateId,
      verification_id: params.verificationId,
    });

    // Map status from IDmeta response (status: number, status_message: string)
    // Pass isFinalized: true to allow VERIFIED status
    const numericStatus = normalizeProviderStatus(
      response.status,
      response.status_message,
      {
        providerName: 'IDmeta',
        result: response.verification,
        isFinalized: true, // This is a finalize call, so allow VERIFIED status
      }
    );
    const mappedStatus = getLegacyStatusForStorage(numericStatus);

    return {
      status: mappedStatus,
      providerData: {
        fullResponse: response,
        verification: response.verification,
        missing_plans: response.missing_plans,
        status_message: response.status_message,
        finalized: response.finalized,
      },
    };
  }

  private verifyWebhookSignature(payload: unknown, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  private mapStatus(status: string): string {
    // Use common status enum to normalize provider-specific status
    const numericStatus = normalizeProviderStatus(status, undefined, {
      providerName: 'IDmeta',
    });

    // Convert back to legacy string format for backward compatibility with database
    return getLegacyStatusForStorage(numericStatus);
  }
}


