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
class EncryptedColumnTransformer implements ValueTransformer {
  private encryption: EncryptionService | null = null;
  private static readonly ENCRYPTED_SHAPE = /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i;

  /** For tests + bootstrap from app.module. Wired at startup. */
  __setEncryptionService(svc: EncryptionService): void {
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
    if (!EncryptedColumnTransformer.ENCRYPTED_SHAPE.test(value)) {
      // Legacy plaintext — pass through. Migration in 1762100000000 backfills.
      return value;
    }
    return this.encryption.decrypt(value);
  }
}

export const encryptedColumnTransformer = new EncryptedColumnTransformer();
