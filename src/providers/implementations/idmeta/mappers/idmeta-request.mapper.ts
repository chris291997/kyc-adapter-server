import { Injectable } from '@nestjs/common';
import { VerificationRequest } from '../../../interfaces/kyc-provider.interface';
import { IDmetaSessionRequest } from '../idmeta-http.client';

@Injectable()
export class IDmetaRequestMapper {
  toIDmetaRequest(internal: VerificationRequest): IDmetaSessionRequest {
    return {
      template_id: internal.templateId || '426', // Default IDmeta template
      callback_url: internal.callbackUrl,
      metadata: {
        tenant_id: internal.tenantId,
        user_email: internal.userEmail,
        user_phone: internal.userPhone,
        ...internal.metadata,
      },
    };
  }
}


