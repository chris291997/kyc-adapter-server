import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Verification } from '../database/entities/verification.entity';
import { VerificationDocument } from '../database/entities/verification-document.entity';
import { Account } from '../database/entities/account.entity';
import { VerificationsService } from './verifications.service';
import { VerificationsController } from './verifications.controller';
import { ProvidersModule } from '../providers/providers.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Verification, VerificationDocument, Account]),
    // Only register Bull queue if Redis is available
    ...(process.env.REDIS_HOST ? [BullModule.registerQueue({
      name: 'verification-processing',
    })] : []),
    ProvidersModule,
    WebSocketModule,
  ],
  providers: [VerificationsService],
  controllers: [VerificationsController],
  exports: [VerificationsService],
})
export class VerificationsModule {}
