import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncryptionService } from './encryption.service';
import { RateLimitService } from './rate-limit.service';
import { AuditService } from './audit.service';
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
  ],
  exports: [
    EncryptionService,
    RateLimitService,
    AuditService,
  ],
})
export class CommonModule {}
