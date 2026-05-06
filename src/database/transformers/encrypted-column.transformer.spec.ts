import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../common/encryption.service';
import { encryptedColumnTransformer } from './encrypted-column.transformer';

describe('encryptedColumnTransformer', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(32);
    encryptedColumnTransformer.__setEncryptionService(new EncryptionService(new ConfigService()));
  });

  it('passes null through to and from the database', () => {
    expect(encryptedColumnTransformer.to(null)).toBeNull();
    expect(encryptedColumnTransformer.from(null)).toBeNull();
    expect(encryptedColumnTransformer.to(undefined)).toBeNull();
    expect(encryptedColumnTransformer.from(undefined)).toBeNull();
  });

  it('encrypts on the way to the DB and decrypts on the way back', () => {
    const plain = 'idmeta-api-key-XYZ';
    const stored = encryptedColumnTransformer.to(plain) as string;
    expect(stored).not.toBe(plain);
    expect(stored.split(':')).toHaveLength(3);
    expect(encryptedColumnTransformer.from(stored)).toBe(plain);
  });

  it('passes through a value that is not encrypted (legacy plaintext) on read', () => {
    // Legacy rows hold plaintext until the migration runs. Reads must not crash.
    expect(encryptedColumnTransformer.from('legacy-plaintext-key')).toBe('legacy-plaintext-key');
  });
});
