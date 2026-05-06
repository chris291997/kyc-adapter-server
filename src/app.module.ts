import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ProvidersModule } from './providers/providers.module';
import { VerificationsModule } from './verifications/verifications.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WebSocketModule } from './websocket/websocket.module';
import { AdminModule } from './admin/admin.module';
import { TenantModule } from './tenant/tenant.module';
import { CommonModule } from './common/common.module';
import { AccountsModule } from './accounts/accounts.module';
import { EncryptionService } from './common/encryption.service';
import { encryptedColumnTransformer } from './database/transformers/encrypted-column.transformer';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? ['.env'] : ['.env', '.env.example'],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttl = Number(config.get('RATE_LIMIT_TTL', 60)) * 1000;
        const limit = Number(config.get('RATE_LIMIT_MAX', 100));
        const storage = config.get('REDIS_HOST')
          ? new ThrottlerStorageRedisService({
              host: config.get('REDIS_HOST'),
              port: Number(config.get('REDIS_PORT', 6379)),
              password: config.get('REDIS_PASSWORD') || undefined,
            })
          : undefined;
        return {
          throttlers: [{ name: 'default', ttl, limit }],
          storage,
        };
      },
    }),

    // Database
    DatabaseModule,

    // Queue system (optional - only if Redis is available)
    ...(process.env.REDIS_HOST ? [BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    })] : []),

    // Feature modules
    AuthModule,
    ProvidersModule,
    VerificationsModule,
    WebhooksModule,
    WebSocketModule,
    AdminModule,
    TenantModule,
    CommonModule,
    AccountsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly encryption: EncryptionService) {}
  onModuleInit() {
    encryptedColumnTransformer.__setEncryptionService(this.encryption);
  }
}
