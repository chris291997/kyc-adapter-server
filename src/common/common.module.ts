import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { FileStorageService } from './file-storage.service';
import { SharedRedisModule } from '../shared/redis.module';

@Module({
  imports: [
    SharedRedisModule,
  ],
  providers: [
    EncryptionService,
    FileStorageService,
  ],
  exports: [
    EncryptionService,
    FileStorageService,
  ],
})
export class CommonModule {}
