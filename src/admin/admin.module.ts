import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { Provider } from '../database/entities/provider.entity';
import { Verification } from '../database/entities/verification.entity';
import { TenantProviderConfig } from '../database/entities/tenant-provider-config.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant, Provider, Verification, TenantProviderConfig]),
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}

