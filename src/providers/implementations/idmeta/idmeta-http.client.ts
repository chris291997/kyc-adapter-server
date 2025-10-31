import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderCredentials, ProviderConfig } from '../../interfaces/kyc-provider.interface';

export interface IDmetaSessionRequest {
  template_id: string;
  callback_url: string;
  metadata?: Record<string, any>;
}

export interface IDmetaSessionResponse {
  verification_id: string;
  workflow_url: string;
  expires_at: string;
  verification?: any;
  template?: any;
  tool_settings?: any[];
  plans?: any[];
  fullResponse?: any; // Store full response for additional data extraction
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
  pcnFormData?: string; // for personal information variant
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
  status?: boolean | string | number;
  message?: string;
  result?: any;
}

@Injectable()
export class IDmetaHttpClient {
  private readonly logger = new Logger(IDmetaHttpClient.name);
  private baseUrl: string;
  private apiKey: string;
  private secretKey: string;
  private apiVersion: string;
  private timeout: number;

  constructor(private readonly configService: ConfigService) {}

  async initialize(credentials: ProviderCredentials, config?: ProviderConfig): Promise<void> {
    this.baseUrl = credentials.baseUrl || this.configService.get('IDMETA_BASE_URL', 'https://integrate.idmetagroup.com/api');
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
      const response = await axios.post(endpoint, {
        template_id: request.template_id,
        callback_url: request.callback_url,
        metadata: request.metadata,
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      // Map the actual IDmeta response structure
      const verificationId = response.data.verification?.id || response.data.verification_id;
      const workflowId = response.data.template?.workflow_id || response.data.workflow_id;
      
      this.logger.log(`[IDmeta] Extracted verification ID: ${verificationId}`);
      this.logger.log(`[IDmeta] Extracted workflow ID: ${workflowId}`);
      
      // Construct workflow URL from base URL and workflow ID
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
        fullResponse: response.data, // Store full response for additional data extraction
      };
    } catch (error) {
      this.logger.error('Failed to create IDmeta session', error.response?.data || error.message);
      throw new Error(`IDmeta session creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getVerificationStatus(verificationId: string): Promise<IDmetaStatusResponse> {
    const axios = require('axios');
    
    const endpoint = `${this.baseUrl}/${this.apiVersion}/verifications/${verificationId}`;
    this.logger.log(`[IDmeta] Getting verification status at endpoint: ${endpoint}`);
    
    try {
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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
          'Authorization': `Bearer ${this.apiKey}`,
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
          'Authorization': `Bearer ${this.apiKey}`,
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
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      return response.data as IDmetaPhilsysResponse;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta Philsys verification', error.response?.data || error.message);
      throw new Error(`IDmeta Philsys verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async documentVerification(
    request: IDmetaDocumentVerificationRequest
  ): Promise<IDmetaDocumentVerificationResponse> {
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
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      return response.data as IDmetaDocumentVerificationResponse;
    } catch (error) {
      this.logger.error('Failed to perform IDmeta Document verification', error.response?.data || error.message);
      throw new Error(`IDmeta Document verification failed: ${error.response?.data?.message || error.message}`);
    }
  }
}

