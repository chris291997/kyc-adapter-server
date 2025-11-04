import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncryptionService } from './encryption.service';
import { RateLimitService } from './rate-limit.service';
import { AuditService } from './audit.service';
import { FileStorageService } from './file-storage.service';
import { SharedRedisModule } from '../shared/redis.module';
import { AuditLog } from '../database/entities/audit-log.entity';

@Module({
  imports: [
    SharedRedisModule,
    TypeOrmModule.forFeature([AuditLog]),
  ],
  providers: [
    EncryptionService,
    RateLimitService,
    AuditService,
    FileStorageService,
  ],
  exports: [
    EncryptionService,
    RateLimitService,
    AuditService,
    FileStorageService,
  ],
})
export class CommonModule {}
