import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Verification } from '../database/entities/verification.entity';
import { KYCWebSocketGateway } from './websocket.gateway';
import { EventPublisher } from './event-publisher.service';
import { SharedRedisModule } from '../shared/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Verification]),
    SharedRedisModule,
    AuthModule,
  ],
  providers: [
    KYCWebSocketGateway,
    EventPublisher,
  ],
  exports: [
    KYCWebSocketGateway,
    EventPublisher,
  ],
})
export class WebSocketModule {}
