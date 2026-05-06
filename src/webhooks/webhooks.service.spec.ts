import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhooksService } from './webhooks.service';
import { WebhookLog } from '../database/entities/webhook-log.entity';
import { Verification } from '../database/entities/verification.entity';
import { Account } from '../database/entities/account.entity';
import { ProvidersFactory } from '../providers/providers.factory';
import { WebhookSignatureService } from './webhook-signature.service';
import { OutgoingWebhookService } from './outgoing-webhook.service';
import { EventPublisher } from '../websocket/event-publisher.service';
import { KYCWebSocketGateway } from '../websocket/websocket.gateway';

describe('WebhooksService', () => {
  let service: WebhooksService;
  const mockWebhookLogRepo: any = {
    save: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const mockVerificationRepo: any = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const mockAccountRepo: any = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const mockProvidersFactory: any = {
    getProviderById: jest.fn(),
    getPrimaryProviderConfig: jest.fn(),
    getProviderEntityById: jest.fn(),
  };
  const mockSignatureService: any = {
    verifySignature: jest.fn(),
  };
  const mockOutgoingWebhookService: any = {
    sendWebhook: jest.fn(),
  };
  const mockEventPublisher: any = {
    publish: jest.fn().mockResolvedValue(undefined),
  };
  const mockWebSocketGateway: any = {
    broadcast: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: getRepositoryToken(WebhookLog), useValue: mockWebhookLogRepo },
        { provide: getRepositoryToken(Verification), useValue: mockVerificationRepo },
        { provide: getRepositoryToken(Account), useValue: mockAccountRepo },
        { provide: ProvidersFactory, useValue: mockProvidersFactory },
        { provide: WebhookSignatureService, useValue: mockSignatureService },
        { provide: OutgoingWebhookService, useValue: mockOutgoingWebhookService },
        { provide: EventPublisher, useValue: mockEventPublisher },
        { provide: KYCWebSocketGateway, useValue: mockWebSocketGateway },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    jest.clearAllMocks();
  });

  it('should infer tenantId and verify signature when webhookSecret present', async () => {
    const providerId = 'prov-1';
    const payload = { verification_id: 'ext-1', metadata: { tenantId: 'tenant-123' } };
    const signature = 'a'.repeat(64);

    mockWebhookLogRepo.save.mockResolvedValue({ id: 'log-1' });
    mockProvidersFactory.getProviderEntityById.mockResolvedValue({
      id: 'p1',
      api_key: 'k',
      secret_key: 's',
      webhook_secret: 'shared-secret',
      base_url: 'https://provider',
      config: {},
    });
    mockProvidersFactory.getProviderById.mockResolvedValue({
      isInitialized: false,
      initialize: jest.fn().mockResolvedValue(undefined),
      handleWebhook: jest.fn().mockResolvedValue({
        verificationId: 'ext-1',
        status: 'approved',
        result: { ok: true },
        event: 'verification.completed',
      }),
    });
    mockProvidersFactory.getPrimaryProviderConfig.mockResolvedValue({ config: { webhookSecret: 'shared' } });
    mockSignatureService.verifySignature.mockReturnValue(true);
    mockVerificationRepo.findOne.mockResolvedValue({ id: 'ver-1', callback_url: null });

    const result = await service.handleProviderWebhook(providerId, payload as any, signature);

    expect(mockSignatureService.verifySignature).toHaveBeenCalled();
    expect(mockVerificationRepo.update).toHaveBeenCalledWith('ver-1', expect.objectContaining({ status: 'approved' }));
    expect(result.received).toBe(true);
  });

  it('should reject when signature is missing (hard-fail)', async () => {
    const providerId = 'prov-1';
    const payload = { verification_id: 'ext-2' };

    mockWebhookLogRepo.save.mockResolvedValue({ id: 'log-2' });
    mockProvidersFactory.getProviderEntityById.mockResolvedValue({
      id: 'p1',
      api_key: 'k',
      secret_key: 's',
      webhook_secret: 'secret',
      base_url: 'https://provider',
      config: {},
    });
    mockProvidersFactory.getProviderById.mockResolvedValue({
      isInitialized: false,
      initialize: jest.fn().mockResolvedValue(undefined),
      handleWebhook: jest.fn(),
    });

    await expect(
      service.handleProviderWebhook(providerId, payload as any, undefined),
    ).rejects.toThrow(/signature/i);
  });

  describe('handleProviderWebhook hard-fails', () => {
    beforeEach(() => {
      mockProvidersFactory.getProviderEntityById.mockResolvedValue({
        id: 'p1',
        api_key: 'k',
        secret_key: 's',
        webhook_secret: 'w',
        base_url: 'https://provider',
      });
      mockProvidersFactory.getProviderById.mockResolvedValue({
        isInitialized: false,
        initialize: jest.fn().mockResolvedValue(undefined),
        handleWebhook: jest.fn(),
      });
      mockWebhookLogRepo.save.mockResolvedValue({ id: 'log1' });
    });

    it('rejects when signature header is missing', async () => {
      await expect(
        service.handleProviderWebhook('p1', { tenant_id: 't1' }, undefined),
      ).rejects.toThrow(/signature/i);
      expect(mockWebhookLogRepo.update).toHaveBeenCalledWith(
        'log1',
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('rejects when provider has no webhook_secret', async () => {
      mockProvidersFactory.getProviderEntityById.mockResolvedValue({
        id: 'p1', api_key: 'k', secret_key: 's', webhook_secret: null, base_url: 'https://provider',
      });
      await expect(
        service.handleProviderWebhook('p1', { tenant_id: 't1' }, 'a'.repeat(64)),
      ).rejects.toThrow(/webhook secret/i);
      expect(mockWebhookLogRepo.update).toHaveBeenCalledWith(
        'log1',
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('rejects when signature is invalid', async () => {
      mockSignatureService.verifySignature.mockReturnValue(false);
      await expect(
        service.handleProviderWebhook('p1', { tenant_id: 't1' }, 'a'.repeat(64)),
      ).rejects.toThrow(/invalid.*signature/i);
      expect(mockWebhookLogRepo.update).toHaveBeenCalledWith(
        'log1',
        expect.objectContaining({ status: 'failed' }),
      );
    });
  });
});


