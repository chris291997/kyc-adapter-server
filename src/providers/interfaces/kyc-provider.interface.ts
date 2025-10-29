export enum ProviderType {
  SINGLE_STEP = 'single_step',
  MULTI_STEP = 'multi_step',
  ASYNC_WEBHOOK = 'async_webhook',
}

export enum ProcessingMethod {
  DIRECT = 'direct',
  EXTERNAL_LINK = 'external_link',
  POLLING = 'polling',
}

export interface ProviderCredentials {
  apiKey: string;
  secretKey?: string;
  webhookSecret?: string;
  baseUrl?: string;
  apiVersion?: string;
}

export interface ProviderConfig {
  timeout?: number;
  retryAttempts?: number;
  customSettings?: Record<string, any>;
}

export interface ProviderCapabilities {
  // Document verification
  supportsDocumentVerification: boolean;
  supportedDocumentTypes: string[];
  supportedCountries: string[];

  // Face verification
  supportsFaceVerification: boolean;
  supportsLiveness: boolean;
  supportsFaceMatch: boolean;

  // Biometrics
  supportsBiometrics: boolean;
  supportsFingerprintVerification: boolean;

  // Checks
  supportsAML: boolean;
  supportsPEP: boolean;
  supportsSanctionsScreening: boolean;
  supportsAddressVerification: boolean;

  // Technical
  supportsWebhooks: boolean;
  supportsMultiStep: boolean;
  supportsHostedWorkflow: boolean;
  supportsPolling: boolean;
  supportsRealTimeUpdates: boolean;

  // Processing
  averageProcessingTime: number; // seconds
  maxFileSize: number; // bytes
  supportedImageFormats: string[];
}

export interface VerificationRequest {
  verificationId: string;
  tenantId: string;
  userEmail?: string;
  userPhone?: string;
  metadata?: Record<string, any>;
  documents?: DocumentUpload[];
  templateId?: string;
  callbackUrl?: string;
}

export interface DocumentUpload {
  type: string;
  data: string; // base64 or file path
  filename?: string;
  mimeType?: string;
}

export interface VerificationResponse {
  id: string;
  providerVerificationId: string;
  status: string;
  result?: any;
  sessionUrl?: string;
  statusUrl?: string;
  expiresAt?: Date;
  processingMethod: ProcessingMethod;
  // Additional provider-specific data
  providerData?: {
    verification?: any;
    template?: any;
    tool_settings?: any[];
    plans?: any[];
    fullResponse?: any;
  };
}

export interface VerificationStatusResponse {
  id: string;
  status: string;
  result?: any;
  progress?: number;
  step?: string;
}

export interface WebhookResult {
  verificationId: string;
  status: string;
  result?: any;
  event?: string;
  step?: string;
  progress?: number;
}

export interface ProviderHealthResponse {
  isHealthy: boolean;
  latency?: number;
  error?: string;
}

/**
 * Universal interface that ALL KYC providers must implement
 * This is the contract that enables provider agnosticism
 */
export interface IKycProvider {
  // Metadata
  readonly name: string;
  readonly type: ProviderType;
  readonly isInitialized: boolean;
  readonly capabilities: ProviderCapabilities;

  /**
   * Initialize provider with credentials and configuration
   * Called once when provider is first used
   */
  initialize(
    credentials: ProviderCredentials,
    config?: ProviderConfig
  ): Promise<void>;

  /**
   * Create a new verification session
   * Returns session info (may include hosted URL for multi-step)
   */
  createVerification(
    request: VerificationRequest
  ): Promise<VerificationResponse>;

  /**
   * Get current status of a verification
   * Used for polling or status checks
   */
  getVerificationStatus(
    verificationId: string
  ): Promise<VerificationStatusResponse>;

  /**
   * Cancel an ongoing verification
   * Returns true if successfully cancelled
   */
  cancelVerification(verificationId: string): Promise<boolean>;

  /**
   * Handle incoming webhook from provider
   * Returns processed result and internal verification ID
   * Provider must be initialized before calling this method
   */
  handleWebhook(
    payload: unknown,
    signature?: string
  ): Promise<WebhookResult>;

  /**
   * Check if provider is healthy and reachable
   */
  healthCheck(): Promise<ProviderHealthResponse>;
}


