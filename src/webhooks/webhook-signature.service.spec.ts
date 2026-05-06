import { WebhookSignatureService } from './webhook-signature.service';
import * as crypto from 'crypto';

describe('WebhookSignatureService.verifySignature', () => {
  let service: WebhookSignatureService;
  const secret = 'test-secret';
  const payload = { verification_id: 'abc', status: 'verified' };
  const validSig = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  beforeEach(() => {
    service = new WebhookSignatureService();
  });

  it('returns true for a valid signature', () => {
    expect(service.verifySignature(payload, validSig, secret)).toBe(true);
  });

  it('returns false for an invalid (correct-length, wrong-bytes) signature', () => {
    const wrong = 'a'.repeat(64);
    expect(service.verifySignature(payload, wrong, secret)).toBe(false);
  });

  it('returns false for a too-short signature without throwing', () => {
    expect(() => service.verifySignature(payload, 'abc', secret)).not.toThrow();
    expect(service.verifySignature(payload, 'abc', secret)).toBe(false);
  });

  it('returns false for a too-long signature without throwing', () => {
    const tooLong = 'a'.repeat(128);
    expect(() => service.verifySignature(payload, tooLong, secret)).not.toThrow();
    expect(service.verifySignature(payload, tooLong, secret)).toBe(false);
  });

  it('returns false for non-hex signature without throwing', () => {
    const nonHex = '!'.repeat(64);
    expect(service.verifySignature(payload, nonHex, secret)).toBe(false);
  });

  it('returns false for undefined signature', () => {
    expect(service.verifySignature(payload, undefined as any, secret)).toBe(false);
  });

  it('returns false for empty secret', () => {
    expect(service.verifySignature(payload, validSig, '')).toBe(false);
  });
});
