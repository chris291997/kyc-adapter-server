import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderCredentials, ProviderConfig } from '../../interfaces/kyc-provider.interface';

export interface IDmetaSessionRequest {
  template_id: string;
  callback_url?: string;
  metadata?: any;
}

export interface IDmetaSessionResponse {
  verification_id: string;
  workflow_url: string;
  expires_at: string;
  verification?: any;
  template?: any;
  tool_settings?: any;
  plans?: any;
  fullResponse?: any;
}

export interface IDmetaStatusResponse {
  verification_id: string;
  status: string;
  result?: any;
}

export interface IDmetaPhilsysRequest {
  pcn?: string;
  face_liveness_session_id: string;
  template_id: string;
  verification_id: string;
  pcnFormData?: string;
}

export interface IDmetaPhilsysResponse {
  status: number;
  status_message: string;
  message: string;
  result?: string | any;
}

export interface IDmetaDocumentVerificationRequest {
  imageFrontSide: string;
  imageBackSide?: string;
  template_id: string;
  verification_id: string;
}

export interface IDmetaDocumentVerificationResponse {
  status: string | boolean;
  result?: any;
  message?: string;
}

export interface IDmetaPhLtoDriversLicenseRequest {
  licenseNo: string;
  template_id: string;
  verification_id: string;
}

export interface IDmetaPhLtoDriversLicenseResponse {
  status: number | string;
  status_message?: string;
  message?: string;
  result?: any;
}

export interface IDmetaPhNationalPoliceRequest {
  surname: string;
  clearanceNo: string;
  template_id: string;
  verification_id: string;
}

export interface IDmetaPhNationalPoliceResponse {
  status: number | string;
  status_message?: string;
  message?: string;
  result?: any;
}

export interface IDmetaPhNbiRequest {
  clearanceNo: string;
  template_id: string;
  verification_id: string;
}

export interface IDmetaPhNbiResponse {
  status: number | string;
  status_message?: string;
  message?: string;
  result?: any;
}

export interface IDmetaPhPrcRequest {
  profession: string;
  licenseNo?: string;
  dateOfBirth?: string;
  firstName?: string;
  lastName?: string;
  template_id: string;
  verification_id: string;
}

export interface IDmetaPhPrcResponse {
  status: number | string;
  status_message?: string;
  message?: string;
  result?: any;
}

export interface IDmetaPhSssRequest {
  crnSsNumber: string;
  template_id: string;
  verification_id: string;
}

export interface IDmetaPhSssResponse {
  status: number | string;
  status_message?: string;
  message?: string;
  result?: any;
}

export interface IDmetaBiometricsFaceMatchRequest {
  image1: string;
  image2: string;
  template_id: string;
  verification_id: string;
}

export interface IDmetaBiometricsFaceMatchResponse {
  status: boolean;
  message: string;
  result?: {
    message?: string;
    score?: number;
    status?: string;
  };
}

export interface IDmetaBiometricsRegistrationRequest {
  username: string;
  image: string;
  template_id: string;
  verification_id: string;
}

export interface IDmetaBiometricsRegistrationResponse {
  status: boolean;
  message: string;
  result?: {
    status?: string;
    message?: string;
    result?: {
      associatedVerificationId?: string;
      faceId?: string;
      imageUrl?: string;
      timestamp?: string;
    };
  };
  apiRequest?: any;
}

export interface IDmetaCustomDocumentRequest {
  document?: string;
  template_id: string;
  verification_id: string;
}

export interface IDmetaCustomDocumentResponse {
  status: boolean;
  message: string;
  result?: {
    formData?: any;
  };
}

export interface IDmetaBiometricVerificationRequest {
  image?: string;
  image_base64?: string;
  template_id: string;
  verification_id: string;
}

export interface IDmetaBiometricVerificationResponse {
  status: boolean;
  message: string;
  result?: {
    status?: string;
    probability?: number;
    message?: string;
    faceId?: string;
    timestamp?: string;
  };
  apiRequest?: any;
}

export interface IDmetaFinalizeVerificationRequest {
  template_id: string;
  verification_id: string;
}

export interface IDmetaFinalizeVerificationResponse {
  message: string;
  verification?: any;
  missing_plans?: any[];
  status?: number;
  status_message?: string;
  finalized?: boolean;
}

export interface IDmetaManualFinalizeVerificationRequest {
  template_id: string;
  verification_id: string;
}

export interface IDmetaManualFinalizeVerificationResponse {
  message: string;
  verification?: any;
  missing_plans?: any[];
  status?: number;
  status_message?: string;
  finalized?: boolean;
}

@Injectable()
export class IDmetaHttpClient {
  private readonly logger = new Logger(IDmetaHttpClient.name);
  private baseUrl: string;
  private apiKey: string;
  private secretKey: string;
  private apiVersion: string;
  private timeout: number;

  constructor(private configService: ConfigService) {}

  async initialize(credentials: ProviderCredentials, config?: ProviderConfig): Promise<void> {
    // Use credentials.baseUrl if provided, otherwise check environment variable, then fallback to default
    this.baseUrl = credentials.baseUrl || 
                   this.configService?.get('IDMETA_BASE_URL') || 
                   'https://integrate.idmetagroup.com/api';
    this.apiKey = credentials.apiKey;
    this.secretKey = credentials.secretKey;
    this.apiVersion = credentials.apiVersion || 'v1';
    this.timeout = config?.timeout || 30000;
  }

  async createSession(request: IDmetaSessionRequest): Promise<IDmetaSessionResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/create-verification`;
    this.logger.log(`[IDmeta] Creating verification session at endpoint: ${endpoint}`);
    this.logger.debug(`[IDmeta] Request payload:`, {
      template_id: request.template_id,
      callback_url: request.callback_url,
      metadata: request.metadata,
    });
    
    try {
      const response = await axios.post(
        endpoint,
        {
        template_id: request.template_id,
        callback_url: request.callback_url,
        metadata: request.metadata,
        },
        {
        headers: {
            Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
        }
      );

      const verificationId = response.data.verification?.id || response.data.verification_id;
      const workflowId = response.data.template?.workflow_id || response.data.workflow_id;
      this.logger.log(`[IDmeta] Extracted verification ID: ${verificationId}`);
      this.logger.log(`[IDmeta] Extracted workflow ID: ${workflowId}`);
      
      const workflowUrl = workflowId 
        ? `${this.baseUrl}/${this.apiVersion}/workflows/${workflowId}`
        : response.data.workflow_url;

      return {
        verification_id: verificationId,
        workflow_url: workflowUrl,
        expires_at: response.data.expires_at || response.data.verification?.verification_date,
        verification: response.data.verification,
        template: response.data.template,
        tool_settings: response.data.tool_settings,
        plans: response.data.plans,
        fullResponse: response.data,
      };
    } catch (error) {
      this.logger.error('Failed to create IDmeta verification session', error.response?.data || error.message);
      throw new Error(
        `IDmeta session creation failed: ${error.response?.data?.message || error.message}`
      );
    }
  }

  async getVerificationStatus(verificationId: string): Promise<IDmetaStatusResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verifications/${verificationId}`;
    this.logger.log(`[IDmeta] Getting verification status at endpoint: ${endpoint}`);
    
    try {
      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: this.timeout,
      });

      return {
        verification_id: response.data.verification_id,
        status: response.data.status,
        result: response.data.result,
      };
    } catch (error) {
      this.logger.error('Failed to get IDmeta verification status', error.response?.data || error.message);
      throw new Error(`IDmeta status check failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async cancelVerification(verificationId: string): Promise<void> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verifications/${verificationId}`;
    this.logger.log(`[IDmeta] Cancelling verification at endpoint: ${endpoint}`);
    
    try {
      await axios.delete(endpoint, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: this.timeout,
      });
    } catch (error) {
      this.logger.error('Failed to cancel IDmeta verification', error.response?.data || error.message);
      throw new Error(`IDmeta cancellation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async healthCheck(): Promise<void> {
    const axios = require('axios');
    try {
      await axios.get(`${this.baseUrl}/health`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 5000,
      });
    } catch (error) {
      this.logger.error('IDmeta health check failed', error.response?.data || error.message);
      throw new Error(`IDmeta health check failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async verifyPhilsys(request: IDmetaPhilsysRequest): Promise<IDmetaPhilsysResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/philippines/philsys`;
    this.logger.log(`[IDmeta] Philsys verification at endpoint: ${endpoint}`);

    try {
      const payload: any = {
        template_id: request.template_id,
        verification_id: request.verification_id,
        face_liveness_session_id: request.face_liveness_session_id,
      };

      if (request.pcn) payload.pcn = request.pcn;
      if (request.pcnFormData) payload.pcnFormData = request.pcnFormData;

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta Philsys verification', error.response?.data || error.message);
      throw new Error(`IDmeta Philsys verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Validate that a buffer contains valid image data by checking magic bytes
   */
  private validateImageBuffer(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 4) return false;
    
    // Check for common image format magic bytes
    // JPEG: FF D8 FF
    // PNG: 89 50 4E 47
    // GIF: 47 49 46 38 (GIF8)
    // WEBP: Check for RIFF header at start
    const header = buffer.slice(0, 12);
    
    // JPEG
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return true;
    // PNG
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return true;
    // GIF
    if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) return true;
    // WEBP (RIFF...WEBP)
    if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
        header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) return true;
    
    return false;
  }

  async documentVerification(request: IDmetaDocumentVerificationRequest): Promise<IDmetaDocumentVerificationResponse> {
    const axios = require('axios');
    const FormData = require('form-data');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/document_verification`;
    this.logger.log(`[IDmeta] Document verification at endpoint: ${endpoint}`);

    try {
      // Create FormData instance
      const formData = new FormData();

      // Extract base64 string and MIME type from data URI if needed
      const extractBase64 = (dataUri: string): { base64: string; mimeType: string } => {
        if (dataUri.startsWith('data:')) {
          const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            return {
              base64: matches[2],
              mimeType: matches[1] || 'image/jpeg',
            };
          }
        }
        // If not a data URI, assume it's plain base64 (default to JPEG)
        return {
          base64: dataUri,
          mimeType: 'image/jpeg',
        };
      };

      // Get file extension from MIME type
      const getExtension = (mimeType: string): string => {
        const mimeMap: Record<string, string> = {
          'image/jpeg': '.jpg',
          'image/jpg': '.jpg',
          'image/png': '.png',
          'image/gif': '.gif',
          'image/webp': '.webp',
        };
        return mimeMap[mimeType] || '.jpg';
      };

      // Validate and convert base64 to Buffer for front side
      const frontData = extractBase64(request.imageFrontSide);
      const frontBase64Clean = frontData.base64.replace(/\s/g, '');
      
      if (!frontBase64Clean || frontBase64Clean.length === 0) {
        throw new Error('Front image base64 string is empty');
      }
      
      // Base64 strings should be at least ~100 chars for even tiny images (100 bytes)
      // A typical ID card image in base64 is thousands of characters
      if (frontBase64Clean.length < 100) {
        this.logger.error(`Front image base64 string is suspiciously short: ${frontBase64Clean.length} characters. Expected at least 1000+ for a valid image.`);
        throw new Error(`Front image base64 string is too short (${frontBase64Clean.length} chars). Image may be incomplete or invalid.`);
      }
      
      let frontBuffer: Buffer;
      try {
        frontBuffer = Buffer.from(frontBase64Clean, 'base64');
      } catch (error) {
        throw new Error(`Failed to decode front image base64: ${error.message}`);
      }
      
      if (!frontBuffer || frontBuffer.length === 0) {
        throw new Error('Front image buffer is empty after decoding');
      }
      
      // Minimum image size check (even tiny 1x1 pixel images are ~100 bytes)
      // Typical ID card images are 50KB - 500KB+
      const MIN_IMAGE_SIZE = 100; // bytes
      if (frontBuffer.length < MIN_IMAGE_SIZE) {
        this.logger.error(`Front image buffer is too small: ${frontBuffer.length} bytes. Minimum expected: ${MIN_IMAGE_SIZE} bytes. First 16 bytes: ${frontBuffer.slice(0, 16).toString('hex')}`);
        throw new Error(`Front image is too small (${frontBuffer.length} bytes). This is likely not a valid image file.`);
      }
      
      // Validate it's actually an image by checking magic bytes
      const isValidImage = this.validateImageBuffer(frontBuffer);
      if (!isValidImage) {
        this.logger.error(`Front image buffer failed magic byte validation (${frontBuffer.length} bytes). First 16 bytes: ${frontBuffer.slice(0, 16).toString('hex')}. Expected JPEG (FFD8FF), PNG (89504E47), GIF (47494638), or WEBP (52494646...57454250)`);
        throw new Error(`Front image is not a valid image format. Buffer size: ${frontBuffer.length} bytes. Expected valid JPEG, PNG, GIF, or WEBP image.`);
      } else {
        this.logger.debug(`Front image validated successfully (${frontBuffer.length} bytes)`);
      }
      
      const frontExtension = getExtension(frontData.mimeType);
      const frontFilename = `image_front${frontExtension}`;
      
      // Append as file field (matching curl --form 'imageFrontSide=@file')
      // Use proper filename with extension for IDmeta to recognize it as an image
      formData.append('imageFrontSide', frontBuffer, {
        filename: frontFilename,
        contentType: frontData.mimeType,
        knownLength: frontBuffer.length,
      });

      // Add back side if provided (as file field)
      if (request.imageBackSide) {
        const backData = extractBase64(request.imageBackSide);
        const backBase64Clean = backData.base64.replace(/\s/g, '');
        
        if (!backBase64Clean || backBase64Clean.length === 0) {
          throw new Error('Back image base64 string is empty');
        }
        
        let backBuffer: Buffer;
        try {
          backBuffer = Buffer.from(backBase64Clean, 'base64');
        } catch (error) {
          throw new Error(`Failed to decode back image base64: ${error.message}`);
        }
        
        if (!backBuffer || backBuffer.length === 0) {
          throw new Error('Back image buffer is empty after decoding');
        }
        
        // Validate it's actually an image
        const isValidBackImage = this.validateImageBuffer(backBuffer);
        if (!isValidBackImage) {
          this.logger.warn(`Back image buffer failed magic byte validation (${backBuffer.length} bytes), but proceeding`);
        } else {
          this.logger.debug(`Back image validated successfully (${backBuffer.length} bytes)`);
        }
        
        const backExtension = getExtension(backData.mimeType);
        const backFilename = `image_back${backExtension}`;
        
        formData.append('imageBackSide', backBuffer, {
          filename: backFilename,
          contentType: backData.mimeType,
          knownLength: backBuffer.length,
        });
      }

      // Add text fields (matching curl --form 'template_id="426"')
      // Note: FormData.append with string value creates a text field, not a file
      formData.append('template_id', String(request.template_id));
      formData.append('verification_id', String(request.verification_id));

      // Get form data headers (includes Content-Type with boundary)
      const formHeaders = formData.getHeaders();

      this.logger.debug(`[IDmeta] FormData fields: imageFrontSide (${frontBuffer.length} bytes), ${request.imageBackSide ? 'imageBackSide, ' : ''}template_id=${request.template_id}, verification_id=${request.verification_id}`);

      const response = await axios.post(endpoint, formData, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...formHeaders, // This sets Content-Type: multipart/form-data with boundary
        },
        timeout: this.timeout,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta Document verification', error.response?.data || error.message);
      throw new Error(`IDmeta Document verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async verifyPhLtoDriversLicense(request: IDmetaPhLtoDriversLicenseRequest): Promise<IDmetaPhLtoDriversLicenseResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/philippines/drivinglicense`;
    this.logger.log(`[IDmeta] PH LTO Drivers License verification at endpoint: ${endpoint}`);

    try {
      const response = await axios.post(
        endpoint,
        {
          licenseNo: request.licenseNo,
          template_id: request.template_id,
          verification_id: request.verification_id,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta PH LTO Drivers License verification', error.response?.data || error.message);
      throw new Error(`IDmeta PH LTO Drivers License verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async verifyPhNationalPolice(request: IDmetaPhNationalPoliceRequest): Promise<IDmetaPhNationalPoliceResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/philippines/nationalpolice`;
    this.logger.log(`[IDmeta] PH National Police verification at endpoint: ${endpoint}`);

    try {
      const response = await axios.post(
        endpoint,
        {
          surname: request.surname,
          clearanceNo: request.clearanceNo,
          template_id: request.template_id,
          verification_id: request.verification_id,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta PH National Police verification', error.response?.data || error.message);
      throw new Error(`IDmeta PH National Police verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async verifyPhNbi(request: IDmetaPhNbiRequest): Promise<IDmetaPhNbiResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/philippines/nbiclearance`;
    this.logger.log(`[IDmeta] PH NBI verification at endpoint: ${endpoint}`);

    try {
      const response = await axios.post(
        endpoint,
        {
          clearanceNo: request.clearanceNo,
          template_id: request.template_id,
          verification_id: request.verification_id,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta PH NBI verification', error.response?.data || error.message);
      throw new Error(`IDmeta PH NBI verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async verifyPhPrc(request: IDmetaPhPrcRequest): Promise<IDmetaPhPrcResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/philippines/prc`;
    this.logger.log(`[IDmeta] PH PRC verification at endpoint: ${endpoint}`);

    try {
      const payload: any = {
        profession: request.profession,
        template_id: request.template_id,
        verification_id: request.verification_id,
      };

      // Add either license-based or name-based search parameters
      if (request.licenseNo && request.dateOfBirth) {
        payload.licenseNo = request.licenseNo;
        payload.dateofBirth = request.dateOfBirth;
      } else if (request.firstName && request.lastName) {
        payload.firstName = request.firstName;
        payload.lastName = request.lastName;
      }

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta PH PRC verification', error.response?.data || error.message);
      throw new Error(`IDmeta PH PRC verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async verifyPhSss(request: IDmetaPhSssRequest): Promise<IDmetaPhSssResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/philippines/socialsecurity`;
    this.logger.log(`[IDmeta] PH SSS verification at endpoint: ${endpoint}`);

    try {
      const response = await axios.post(
        endpoint,
        {
          crnSsNumber: request.crnSsNumber,
          template_id: request.template_id,
          verification_id: request.verification_id,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta PH SSS verification', error.response?.data || error.message);
      throw new Error(`IDmeta PH SSS verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async biometricsFaceCompare(request: IDmetaBiometricsFaceMatchRequest): Promise<IDmetaBiometricsFaceMatchResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/biometricsfacecompare`;
    this.logger.log(`[IDmeta] Biometrics Face Compare at endpoint: ${endpoint}`);

    try {
      const payload = {
        image1: request.image1,
        image2: request.image2,
        template_id: request.template_id,
        verification_id: request.verification_id,
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta Biometrics Face Compare', error.response?.data || error.message);
      throw new Error(`IDmeta Biometrics Face Compare failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async biometricsRegistration(request: IDmetaBiometricsRegistrationRequest): Promise<IDmetaBiometricsRegistrationResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/biometricsregistration`;
    this.logger.log(`[IDmeta] Biometrics Registration at endpoint: ${endpoint}`);

    try {
      const payload = {
        username: request.username,
        image: request.image,
        template_id: request.template_id,
        verification_id: request.verification_id,
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta Biometrics Registration', error.response?.data || error.message);
      throw new Error(`IDmeta Biometrics Registration failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async customDocument(request: IDmetaCustomDocumentRequest): Promise<IDmetaCustomDocumentResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/customdocument`;
    this.logger.log(`[IDmeta] Custom Document verification at endpoint: ${endpoint}`);

    try {
      const payload: any = {
        template_id: request.template_id,
        verification_id: request.verification_id,
      };

      if (request.document) {
        payload.document = request.document;
      }

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta Custom Document verification', error.response?.data || error.message);
      throw new Error(`IDmeta Custom Document verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async biometricVerification(request: IDmetaBiometricVerificationRequest): Promise<IDmetaBiometricVerificationResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/biometricsverification`;
    this.logger.log(`[IDmeta] Biometric Verification at endpoint: ${endpoint}`);

    try {
      const payload: any = {
        template_id: request.template_id,
        verification_id: request.verification_id,
      };

      // Add image or image_base64 (at least one should be provided)
      if (request.image) {
        payload.image = request.image;
      }
      if (request.image_base64) {
        payload.image_base64 = request.image_base64;
      }

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta Biometric Verification', error.response?.data || error.message);
      throw new Error(`IDmeta Biometric Verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async finalizeVerification(request: IDmetaFinalizeVerificationRequest): Promise<IDmetaFinalizeVerificationResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/finalize-verification`;
    this.logger.log(`[IDmeta] Finalize verification at endpoint: ${endpoint}`);

    try {
      const payload = {
        template_id: request.template_id,
        verification_id: request.verification_id,
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to finalize IDmeta verification', error.response?.data || error.message);
      throw new Error(`IDmeta Finalize Verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async manualFinalizeVerification(request: IDmetaManualFinalizeVerificationRequest): Promise<IDmetaManualFinalizeVerificationResponse> {
    const axios = require('axios');
    const FormData = require('form-data');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/manual-finalize-verification`;
    this.logger.log(`[IDmeta] Manual finalize verification at endpoint: ${endpoint}`);

    try {
      // Manual finalize uses form-data according to Postman collection
      const formData = new FormData();
      formData.append('template_id', String(request.template_id));
      formData.append('verification_id', String(request.verification_id));

      const formHeaders = formData.getHeaders();

      const response = await axios.post(endpoint, formData, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...formHeaders,
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to manually finalize IDmeta verification', error.response?.data || error.message);
      throw new Error(`IDmeta Manual Finalize Verification failed: ${error.response?.data?.message || error.message}`);
    }
  }
}

