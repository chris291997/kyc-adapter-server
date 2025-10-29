import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhooksService } from './webhooks.service';
import { WebhookLog } from '../database/entities/webhook-log.entity';
import { Verification } from '../database/entities/verification.entity';
import { ProvidersFactory } from '../providers/providers.factory';
import { WebhookSignatureService } from './webhook-signature.service';
import { OutgoingWebhookService } from './outgoing-webhook.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  const mockWebhookLogRepo: any = {
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const mockVerificationRepo: any = {
    findOne: jest.fn(),
    update: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: getRepositoryToken(WebhookLog), useValue: mockWebhookLogRepo },
        { provide: getRepositoryToken(Verification), useValue: mockVerificationRepo },
        { provide: ProvidersFactory, useValue: mockProvidersFactory },
        { provide: WebhookSignatureService, useValue: mockSignatureService },
        { provide: OutgoingWebhookService, useValue: mockOutgoingWebhookService },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    jest.clearAllMocks();
  });

  it('should infer tenantId and verify signature when webhookSecret present', async () => {
    const providerId = 'prov-1';
    const payload = { verification_id: 'ext-1', metadata: { tenantId: 'tenant-123' } };
    const signature = 'sig-abc';

    mockWebhookLogRepo.save.mockResolvedValue({ id: 'log-1' });
    // Provider-level config without secret to force tenant-level fallback
    mockProvidersFactory.getProviderEntityById.mockResolvedValue({ config: {} });
    mockProvidersFactory.getProviderById.mockResolvedValue({ handleWebhook: jest.fn().mockResolvedValue({
      verificationId: 'ext-1',
      status: 'approved',
      result: { ok: true },
      event: 'verification.completed',
    })});
    mockProvidersFactory.getPrimaryProviderConfig.mockResolvedValue({ config: { webhookSecret: 'shared' } });
    mockSignatureService.verifySignature.mockReturnValue(true);
    mockVerificationRepo.findOne.mockResolvedValue({ id: 'ver-1', callback_url: null });

    const result = await service.handleProviderWebhook(providerId, payload as any, signature);

    expect(mockProvidersFactory.getPrimaryProviderConfig).toHaveBeenCalledWith('tenant-123');
    expect(mockSignatureService.verifySignature).toHaveBeenCalled();
    expect(mockVerificationRepo.update).toHaveBeenCalledWith('ver-1', expect.objectContaining({ status: 'approved' }));
    expect(result.received).toBe(true);
  });

  it('should skip signature verification if tenantId cannot be inferred', async () => {
    const providerId = 'prov-1';
    const payload = { verification_id: 'ext-2' };
    const signature = undefined;

    mockWebhookLogRepo.save.mockResolvedValue({ id: 'log-2' });
    mockProvidersFactory.getProviderEntityById.mockResolvedValue({ config: {} });
    mockProvidersFactory.getProviderById.mockResolvedValue({ handleWebhook: jest.fn().mockResolvedValue({
      verificationId: 'ext-2',
      status: 'approved',
      result: { ok: true },
    })});
    mockVerificationRepo.findOne.mockResolvedValue({ id: 'ver-2', callback_url: null });

    const result = await service.handleProviderWebhook(providerId, payload as any, signature as any);

    expect(mockProvidersFactory.getPrimaryProviderConfig).not.toHaveBeenCalled();
    expect(mockSignatureService.verifySignature).not.toHaveBeenCalled();
    expect(mockVerificationRepo.update).toHaveBeenCalledWith('ver-2', expect.any(Object));
    expect(result.received).toBe(true);
  });
});


