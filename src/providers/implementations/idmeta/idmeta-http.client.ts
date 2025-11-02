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

  async documentVerification(request: IDmetaDocumentVerificationRequest): Promise<IDmetaDocumentVerificationResponse> {
    const axios = require('axios');
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verification/document_verification`;
    this.logger.log(`[IDmeta] Document verification at endpoint: ${endpoint}`);

    try {
      const payload: any = {
        imageFrontSide: request.imageFrontSide,
        template_id: request.template_id,
        verification_id: request.verification_id,
      };

      if (request.imageBackSide) payload.imageBackSide = request.imageBackSide;

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
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
}

