import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookLog } from '../database/entities/webhook-log.entity';
import { Verification } from '../database/entities/verification.entity';
import { Account } from '../database/entities/account.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { WebhooksController } from './webhooks.controller';
import { PublicWebhooksController } from './public-webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { OutgoingWebhookService } from './outgoing-webhook.service';
import { ProvidersModule } from '../providers/providers.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookLog, Verification, Account, Tenant]),
    ProvidersModule,
    WebSocketModule,
  ],
  providers: [
    WebhooksService,
    WebhookSignatureService,
    OutgoingWebhookService,
  ],
  controllers: [WebhooksController, PublicWebhooksController],
  exports: [WebhooksService, OutgoingWebhookService],
})
export class WebhooksModule {}
