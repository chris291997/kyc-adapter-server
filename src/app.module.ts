import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
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

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
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
})
export class AppModule {}
