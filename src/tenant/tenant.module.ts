import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { Verification } from '../database/entities/verification.entity';
import { ApiKey } from '../database/entities/api-key.entity';
import { User } from '../database/entities/user.entity';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Verification, ApiKey, User]),
  ],
  providers: [TenantService],
  controllers: [TenantController],
})
export class TenantModule {}

