import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { RateLimitService } from './rate-limit.service';
import { FileStorageService } from './file-storage.service';
import { SharedRedisModule } from '../shared/redis.module';

@Module({
  imports: [
    SharedRedisModule,
  ],
  providers: [
    EncryptionService,
    RateLimitService,
    FileStorageService,
  ],
  exports: [
    EncryptionService,
    RateLimitService,
    FileStorageService,
  ],
})
export class CommonModule {}
