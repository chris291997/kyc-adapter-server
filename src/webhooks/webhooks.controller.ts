import { Controller, Post, Get, Param, Body, Headers, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
  ) {}

  @Post('providers/:providerId')
  @ApiOperation({ summary: 'Handle incoming webhook from provider' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  async handleProviderWebhook(
    @Param('providerId') providerId: string,
    @Body() payload: any,
    @Headers('x-webhook-signature') signature: string
  ) {
    return this.webhooksService.handleProviderWebhook(providerId, payload, signature);
  }

  // Slug-based endpoint lives in PublicWebhooksController at /v1/webhook/:providerSlug

  @Get('logs')
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiSecurity('bearer')
  @ApiOperation({ summary: 'Get webhook logs' })
  @ApiResponse({ status: 200, description: 'Webhook logs retrieved successfully' })
  async getWebhookLogs(
    @Param('providerId') providerId?: string,
    @Param('verificationId') verificationId?: string
  ) {
    return this.webhooksService.getWebhookLogs(providerId, verificationId);
  }

  @Post('logs/:id/replay')
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiSecurity('bearer')
  @ApiOperation({ summary: 'Replay failed webhook' })
  @ApiResponse({ status: 200, description: 'Webhook replayed successfully' })
  @ApiResponse({ status: 404, description: 'Webhook log not found' })
  async replayWebhook(@Param('id') webhookLogId: string) {
    return this.webhooksService.replayWebhook(webhookLogId);
  }
}

