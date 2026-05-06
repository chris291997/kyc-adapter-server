import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSignatureService {
  verifySignature(payload: any, signature: string | undefined, secret: string): boolean {
    // Hard-fail on missing inputs
    if (!signature || !secret) {
      return false;
    }
    // Validate shape: 64 hex chars (SHA-256 → 32 bytes → 64 hex)
    if (signature.length !== 64 || !/^[a-f0-9]+$/i.test(signature)) {
      return false;
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest(); // raw Buffer, 32 bytes

    const provided = Buffer.from(signature, 'hex'); // 32 bytes since shape is validated

    // Length is guaranteed equal here, but keep the check for defense-in-depth
    if (provided.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(provided, expected);
  }
  
  // For providers with different signature formats
  verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
    const [timestamp, sig] = signature.split(',').map(s => s.split('=')[1]);
    const signedPayload = `${timestamp}.${payload}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expectedSignature)
    );
  }

  verifyPersonaSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}


