import { Module } from '@nestjs/common';
import { KYCWebSocketGateway } from './websocket.gateway';
import { EventPublisher } from './event-publisher.service';
import { SharedRedisModule } from '../shared/redis.module';

@Module({
  imports: [
    SharedRedisModule,
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
