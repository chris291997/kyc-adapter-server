import { Injectable } from '@nestjs/common';
import { VerificationStatusResponse } from '../../../interfaces/kyc-provider.interface';
import { IDmetaStatusResponse } from '../idmeta-http.client';

@Injectable()
export class IDmetaResponseMapper {
  fromIDmetaStatusResponse(provider: IDmetaStatusResponse): VerificationStatusResponse {
    return {
      id: provider.verification_id,
      status: this.mapStatus(provider.status),
      result: provider.result ? this.mapResult(provider.result) : undefined,
    };
  }

  fromIDmetaWebhookResponse(webhookData: any): any {
    return {
      overall: {
        status: this.mapStatus(webhookData.status),
        confidence: webhookData.confidence_score || 0,
      },
      document: {
        type: webhookData.document_type,
        number: webhookData.document_number,
        country: webhookData.issuing_country,
        expiryDate: webhookData.expiry_date,
      },
      person: {
        firstName: webhookData.first_name,
        lastName: webhookData.last_name,
        dateOfBirth: webhookData.date_of_birth,
      },
      checks: {
        documentAuthenticity: webhookData.checks?.document_check || 'unknown',
        faceMatch: webhookData.checks?.face_match || 'unknown',
        liveness: webhookData.checks?.liveness || 'unknown',
        aml: webhookData.checks?.aml_check || 'unknown',
      },
    };
  }

  private mapStatus(status: string): string {
    const statusMap = {
      'pending': 'pending',
      'processing': 'processing',
      'completed': 'approved',
      'failed': 'rejected',
      'expired': 'expired',
    };
    
    return statusMap[status] || 'pending';
  }

  private mapResult(result: any): any {
    return {
      overall: {
        status: this.mapStatus(result.status),
        confidence: result.confidence_score || 0,
      },
      document: {
        type: result.document_type,
        number: result.document_number,
        country: result.issuing_country,
        expiryDate: result.expiry_date,
      },
      person: {
        firstName: result.first_name,
        lastName: result.last_name,
        dateOfBirth: result.date_of_birth,
      },
      checks: {
        documentAuthenticity: result.checks?.document_check || 'unknown',
        faceMatch: result.checks?.face_match || 'unknown',
        liveness: result.checks?.liveness || 'unknown',
        aml: result.checks?.aml_check || 'unknown',
      },
    };
  }
}


