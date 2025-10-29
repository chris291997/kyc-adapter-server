import { Controller, Post, Param, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { ProvidersFactory } from '../providers/providers.factory';

@ApiTags('Webhooks')
@Controller('v1/webhook')
export class PublicWebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly providersFactory: ProvidersFactory,
  ) {}

  @Post(':providerSlug')
  @ApiOperation({ summary: 'Provider-level webhook endpoint (slug-based, global)' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  async handleProviderWebhookBySlug(
    @Param('providerSlug') providerSlug: string,
    @Body() payload: any,
    @Headers('x-webhook-signature') signature: string
  ) {
    const { id } = await this.providersFactory.getProviderBySlug(providerSlug);
    return this.webhooksService.handleProviderWebhook(id, payload, signature);
  }
}



