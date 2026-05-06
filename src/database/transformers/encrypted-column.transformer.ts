import { ValueTransformer } from 'typeorm';
import { EncryptionService } from '../../common/encryption.service';

/**
 * TypeORM column transformer that encrypts a string on the way to the DB
 * and decrypts on the way back. Tolerant of legacy plaintext rows so
 * deployments can roll over without immediate migration.
 *
 * Stores values in the format: ivHex:authTagHex:ciphertextHex (three colon-separated hex strings).
 * Any value that does NOT match that shape is treated as legacy plaintext and passed through unchanged.
 */

/** IV is always 12 bytes = 24 hex chars; authTag is always 16 bytes = 32 hex chars; ciphertext is variable. */
export const ENCRYPTED_SHAPE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

class EncryptedColumnTransformer implements ValueTransformer {
  private encryption: EncryptionService | null = null;

  /** For tests + bootstrap from app.module. Wired at startup. */
  __setEncryptionService(svc: EncryptionService): void {
    if (this.encryption) {
      throw new Error('EncryptionService already initialized for column transformer');
    }
    this.encryption = svc;
  }

  to(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (!this.encryption) {
      throw new Error('EncryptionService not initialized for column transformer');
    }
    return this.encryption.encrypt(value);
  }

  from(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (!this.encryption) {
      throw new Error('EncryptionService not initialized for column transformer');
    }
    if (!ENCRYPTED_SHAPE.test(value)) {
      // Legacy plaintext — pass through. Migration in 1762100000000 backfills.
      return value;
    }
    return this.encryption.decrypt(value);
  }
}

export const encryptedColumnTransformer = new EncryptedColumnTransformer();
