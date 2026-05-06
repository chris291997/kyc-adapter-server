import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  const key = 'a'.repeat(32);
  let service: EncryptionService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = key;
    service = new EncryptionService(new ConfigService());
  });

  it('round-trips a string', () => {
    const plaintext = 'super-secret-api-key-abc-123';
    const ciphertext = service.encrypt(plaintext);
    expect(ciphertext).not.toContain(plaintext);
    expect(service.decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'hello';
    const c1 = service.encrypt(plaintext);
    const c2 = service.encrypt(plaintext);
    expect(c1).not.toBe(c2);
    expect(service.decrypt(c1)).toBe(plaintext);
    expect(service.decrypt(c2)).toBe(plaintext);
  });

  it('rejects ciphertext with tampered authTag', () => {
    const ciphertext = service.encrypt('hello');
    const [iv, tag, ct] = ciphertext.split(':');
    const tampered = [iv, 'a'.repeat(tag.length), ct].join(':');
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('rejects ciphertext from a different key', () => {
    const ciphertext = service.encrypt('hello');
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    const otherService = new EncryptionService(new ConfigService());
    expect(() => otherService.decrypt(ciphertext)).toThrow();
  });

  it('throws on construction if ENCRYPTION_KEY missing', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => new EncryptionService(new ConfigService())).toThrow(/ENCRYPTION_KEY/);
  });

  it('throws on construction if ENCRYPTION_KEY wrong length', () => {
    process.env.ENCRYPTION_KEY = 'too-short';
    expect(() => new EncryptionService(new ConfigService())).toThrow(/32/);
  });

  it('throws on ciphertext with wrong segment count', () => {
    expect(() => service.decrypt('not-a-valid-ciphertext')).toThrow(/format/i);
    expect(() => service.decrypt('only:two-parts')).toThrow(/format/i);
  });
});
