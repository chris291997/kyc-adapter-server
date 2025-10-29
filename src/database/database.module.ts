import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Tenant } from './entities/tenant.entity';
import { Provider } from './entities/provider.entity';
import { TenantProviderConfig } from './entities/tenant-provider-config.entity';
import { Verification } from './entities/verification.entity';
import { VerificationDocument } from './entities/verification-document.entity';
import { WebhookLog } from './entities/webhook-log.entity';
import { ApiKey } from './entities/api-key.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Account } from './entities/account.entity';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'kyc_adapter',
        entities: [
          Tenant,
          Provider,
          TenantProviderConfig,
          Verification,
          VerificationDocument,
          WebhookLog,
          ApiKey,
          RefreshToken,
          AuditLog,
          Account,
          User,
        ],
        synchronize: process.env.DB_SYNCHRONIZE === 'true',
        logging: process.env.DB_LOGGING === 'true',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }),
    }),
    TypeOrmModule.forFeature([
      Tenant,
      Provider,
      TenantProviderConfig,
      Verification,
      VerificationDocument,
      WebhookLog,
      ApiKey,
      RefreshToken,
      AuditLog,
      Account,
      User,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
