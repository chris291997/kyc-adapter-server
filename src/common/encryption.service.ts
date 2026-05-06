import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly aad = Buffer.from('kyc-adapter', 'utf8');

  constructor(private readonly configService: ConfigService) {
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    if (encryptionKey.length !== 32) {
      throw new Error(
        `ENCRYPTION_KEY must be exactly 32 characters (UTF-8 bytes), giving a 256-bit AES key. ` +
        `Got: ${encryptionKey.length} characters. ` +
        `Generate a suitable key with: openssl rand -base64 24 | head -c 32`
      );
    }
    this.key = Buffer.from(encryptionKey, 'utf8');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    cipher.setAAD(this.aad);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: ivHex:authTagHex:ciphertextHex
    return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAAD(this.aad);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  generateRandomKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
