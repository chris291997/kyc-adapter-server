import { MigrationInterface, QueryRunner } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../common/encryption.service';
import { ENCRYPTED_SHAPE } from '../transformers/encrypted-column.transformer';

/**
 * One-shot migration: encrypt all existing plaintext provider credentials.
 * Reads each row, encrypts non-null api_key/secret_key/webhook_secret if they
 * are not already in encrypted shape (ivHex:authTagHex:ciphertextHex), and writes back.
 *
 * Note: AES-GCM AAD is set to a static app-level value ('kyc-adapter'), not bound to row id.
 * This means an attacker with DB-write access could swap one provider's encrypted columns
 * into another provider's row and the decryption would still succeed. This is an accepted
 * tradeoff: the threat model focuses on confidentiality at rest (read-only DB access),
 * not integrity-against-DB-write. Consider row-bound AAD if write-access threat becomes relevant.
 */
export class EncryptProviderCredentials1762100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const enc = new EncryptionService(new ConfigService());
    const rows: Array<{ id: string; api_key: string | null; secret_key: string | null; webhook_secret: string | null }> =
      await queryRunner.query(`SELECT id, api_key, secret_key, webhook_secret FROM providers`);

    for (const row of rows) {
      const updates: string[] = [];
      const params: any[] = [];

      const tryEncrypt = (col: string, value: string | null) => {
        if (value && !ENCRYPTED_SHAPE.test(value)) {
          updates.push(`${col} = $${params.length + 1}`);
          params.push(enc.encrypt(value));
        }
      };

      tryEncrypt('api_key', row.api_key);
      tryEncrypt('secret_key', row.secret_key);
      tryEncrypt('webhook_secret', row.webhook_secret);

      if (updates.length > 0) {
        params.push(row.id);
        await queryRunner.query(
          `UPDATE providers SET ${updates.join(', ')} WHERE id = $${params.length}`,
          params,
        );
        console.log(`Encrypted ${updates.length} columns on provider ${row.id}`);
      }
    }
  }

  public async down(): Promise<void> {
    // No-op: cannot rebuild plaintext from ciphertext without the key, and we don't want to.
    console.log('Cannot revert encryption migration. Use a backup if you need plaintext back.');
  }
}
