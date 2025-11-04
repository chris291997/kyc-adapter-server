import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'public', 'uploads');

  constructor() {
    // Ensure uploads directory exists
    this.ensureDirectoryExists(this.uploadsDir);
  }

  /**
   * Save a base64 image to the file system
   * @param base64DataUrl Base64 data URL (e.g., "data:image/jpeg;base64,/9j/4AAQ...") or plain base64 string
   * @param verificationId Verification ID for organizing files
   * @param fileName Name for the file (will be auto-generated if not provided)
   * @returns Public URL path to the saved file
   */
  async saveBase64Image(
    base64DataUrl: string,
    verificationId: string,
    fileName?: string
  ): Promise<{ url: string; path: string; mimeType: string; size: number }> {
    try {
      if (!base64DataUrl || typeof base64DataUrl !== 'string') {
        throw new Error('Invalid input: base64DataUrl must be a non-empty string');
      }

      // Log input for debugging (first 100 chars to avoid huge logs)
      const inputPreview = base64DataUrl.length > 100 
        ? `${base64DataUrl.substring(0, 100)}...` 
        : base64DataUrl;
      this.logger.debug(`Saving image. Input length: ${base64DataUrl.length}, preview: ${inputPreview.substring(0, 100)}`);

      let mimeType: string;
      let base64Data: string;

      // Try to parse as data URI first (e.g., "data:image/jpeg;base64,...")
      // More flexible regex to handle various data URI formats
      const dataUriMatch = base64DataUrl.match(/^data:([^;,]+)(?:;base64)?,(.+)$/);
      
      if (dataUriMatch && dataUriMatch.length >= 3) {
        // It's a data URI
        mimeType = (dataUriMatch[1] || '').trim() || 'image/jpeg';
        base64Data = dataUriMatch[2] || '';
        
        if (base64Data.length < 100) {
          this.logger.warn(`⚠️  WARNING: Extracted base64 string is very short (${base64Data.length} chars). Expected 1000+ for a typical image. This may be incomplete or corrupted data.`);
        }
        
        this.logger.debug(`Parsed data URI with MIME type: ${mimeType}, base64 length: ${base64Data.length}`);
      } else {
        // Assume it's plain base64 string (without data URI prefix)
        // Default to JPEG if we can't determine the type
        mimeType = 'image/jpeg';
        base64Data = base64DataUrl.trim();
        
        if (base64Data.length < 100) {
          this.logger.warn(`⚠️  WARNING: Plain base64 string is very short (${base64Data.length} chars). Expected 1000+ for a typical image. This may be incomplete or corrupted data.`);
        }
        
        this.logger.debug(`Parsed as plain base64 string, length: ${base64Data.length}`);
      }

      // Strip whitespace and newlines
      base64Data = base64Data.replace(/\s/g, '');
      
      // Validate we have data
      if (!base64Data || base64Data.length === 0) {
        throw new Error(`Base64 string is empty after parsing. Original input length: ${base64DataUrl?.length || 0}`);
      }
      
      // Try to decode - Buffer.from with 'base64' is lenient, but will handle most cases
      // We'll let the actual file write validate if the image is truly valid
      let decodedBuffer: Buffer;
      try {
        decodedBuffer = Buffer.from(base64Data, 'base64');
        if (decodedBuffer.length === 0 && base64Data.length > 4) {
          // Suspicious: long base64 string that decodes to nothing
          this.logger.warn(`Base64 decoded to empty buffer despite having ${base64Data.length} characters`);
        }
      } catch (error) {
        this.logger.error(`Failed to decode base64. Input length: ${base64Data.length}, First 50 chars: ${base64Data.substring(0, 50)}`);
        throw new Error(`Invalid base64 string format: ${error.message}`);
      }
      
      // Determine file extension from MIME type
      const extension = this.getExtensionFromMimeType(mimeType);
      
      // Create verification-specific directory
      const verificationDir = path.join(this.uploadsDir, 'verifications', verificationId);
      this.ensureDirectoryExists(verificationDir);

      // Generate filename if not provided
      if (!fileName) {
        fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${extension}`;
      } else if (!fileName.includes('.')) {
        fileName = `${fileName}${extension}`;
      }

      const filePath = path.join(verificationDir, fileName);
      // Use the already-validated buffer from above
      const buffer = decodedBuffer;
      
      // Write file
      await fs.promises.writeFile(filePath, buffer);
      
      // Public URL (relative to /uploads)
      const url = `/uploads/verifications/${verificationId}/${fileName}`;
      
      this.logger.log(`Saved image: ${filePath} (${buffer.length} bytes)`);
      
      return {
        url,
        path: filePath,
        mimeType,
        size: buffer.length,
      };
    } catch (error) {
      this.logger.error(`Failed to save base64 image: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    };
    
    return mimeMap[mimeType] || '.jpg';
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      this.logger.log(`Created directory: ${dirPath}`);
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.log(`Deleted file: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete all files for a verification
   */
  async deleteVerificationFiles(verificationId: string): Promise<void> {
    try {
      const verificationDir = path.join(this.uploadsDir, 'verifications', verificationId);
      if (fs.existsSync(verificationDir)) {
        await fs.promises.rm(verificationDir, { recursive: true, force: true });
        this.logger.log(`Deleted verification directory: ${verificationDir}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete verification files: ${error.message}`, error.stack);
      throw error;
    }
  }
}

