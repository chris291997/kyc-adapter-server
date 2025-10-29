import { Test, TestingModule } from '@nestjs/testing';
import { VerificationsService } from './verifications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verification } from '../database/entities/verification.entity';
import { VerificationDocument } from '../database/entities/verification-document.entity';
import { Account } from '../database/entities/account.entity';
import { ProvidersFactory } from '../providers/providers.factory';
import { CreateVerificationDto } from './dto/create-verification.dto';

describe('VerificationsService', () => {
  let service: VerificationsService;
  let verificationRepository: Repository<Verification>;
  let accountRepository: Repository<Account>;
  let providersFactory: ProvidersFactory;

  const mockVerificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockDocumentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockAccountRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockVerificationQueue = {
    add: jest.fn(),
    process: jest.fn(),
  };

  const mockProvidersFactory = {
    getPrimaryProviderConfig: jest.fn(),
    getProviderById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationsService,
        {
          provide: getRepositoryToken(Verification),
          useValue: mockVerificationRepository,
        },
        {
          provide: getRepositoryToken(VerificationDocument),
          useValue: mockDocumentRepository,
        },
        {
          provide: getRepositoryToken(Account),
          useValue: mockAccountRepository,
        },
        {
          provide: 'BullQueue_verification-processing',
          useValue: mockVerificationQueue,
        },
        {
          provide: ProvidersFactory,
          useValue: mockProvidersFactory,
        },
      ],
    }).compile();

    service = module.get<VerificationsService>(VerificationsService);
    verificationRepository = module.get<Repository<Verification>>(getRepositoryToken(Verification));
    accountRepository = module.get<Repository<Account>>(getRepositoryToken(Account));
    providersFactory = module.get<ProvidersFactory>(ProvidersFactory);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createVerification', () => {
    it('should create verification with mock provider when API key is mocked', async () => {
      // Arrange
      const tenantId = 'test-tenant-id';
      const createVerificationDto: CreateVerificationDto = {
        verificationType: 'document',
        userEmail: 'test@example.com',
        userPhone: '+1234567890',
        metadata: { firstName: 'Test', lastName: 'User' },
      };

      const mockProviderConfig = {
        provider_id: 'mock-provider',
        config: { 
          apiKey: 'mock-api-key-12345',
          baseUrl: 'https://mock-provider.com',
          timeout: 30000
        },
        is_enabled: true,
      };

      const mockProvider = {
        isInitialized: false,
        initialize: jest.fn().mockResolvedValue(undefined),
        createVerification: jest.fn().mockResolvedValue({
          status: 'pending',
          externalId: 'ext-123',
          sessionUrl: 'https://mock-provider.com/verify/session-456',
          result: { 
            message: 'Verification initiated',
            sessionId: 'session-456',
            redirectUrl: 'https://mock-provider.com/verify/session-456'
          },
        }),
      };

      const mockAccount = {
        id: 'account-123',
        tenant_id: tenantId,
        email: 'test@example.com',
        verification_status: 'pending',
        getFullName: jest.fn().mockReturnValue('Test User'),
        getDisplayName: jest.fn().mockReturnValue('Test User'),
      };

      const mockVerification = {
        id: 'verification-123',
        tenant_id: tenantId,
        account_id: 'account-123',
        provider_id: 'mock-provider',
        status: 'pending',
        external_id: 'ext-123',
        provider_response: { 
          message: 'Verification initiated',
          sessionId: 'session-456',
          redirectUrl: 'https://mock-provider.com/verify/session-456'
        },
      };

      // Mock the dependencies
      mockProvidersFactory.getPrimaryProviderConfig.mockResolvedValue(mockProviderConfig);
      mockProvidersFactory.getProviderById.mockResolvedValue(mockProvider);
      mockAccountRepository.findOne.mockResolvedValue(null);
      mockAccountRepository.create.mockReturnValue(mockAccount);
      mockAccountRepository.save.mockResolvedValue(mockAccount);
      mockVerificationRepository.create.mockReturnValue(mockVerification);
      mockVerificationRepository.save.mockResolvedValue(mockVerification);
      mockVerificationRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      const result = await service.createVerification(tenantId, createVerificationDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.verificationId).toBe('verification-123');
      expect(result.sessionUrl).toBe('https://mock-provider.com/verify/session-456');
      expect(result.statusUrl).toBe('/api/v1/verifications/verification-123');
      expect(result.websocketChannel).toBe('verification:verification-123');
      expect(mockProvidersFactory.getPrimaryProviderConfig).toHaveBeenCalledWith(tenantId);
      expect(mockProvidersFactory.getProviderById).toHaveBeenCalledWith('mock-provider');
      expect(mockProvider.createVerification).toHaveBeenCalled();
      expect(mockAccountRepository.create).toHaveBeenCalled();
      expect(mockAccountRepository.save).toHaveBeenCalled();
      expect(mockVerificationRepository.create).toHaveBeenCalled();
      expect(mockVerificationRepository.save).toHaveBeenCalled();
    });

    it('should handle provider errors gracefully when API key is invalid', async () => {
      // Arrange
      const tenantId = 'test-tenant-id';
      const createVerificationDto: CreateVerificationDto = {
        verificationType: 'document',
        userEmail: 'test@example.com',
      };

      const mockProviderConfig = {
        provider_id: 'mock-provider',
        config: { 
          apiKey: 'invalid-api-key',
          baseUrl: 'https://mock-provider.com'
        },
        is_enabled: true,
      };

      const mockProvider = {
        isInitialized: false,
        initialize: jest.fn().mockResolvedValue(undefined),
        createVerification: jest.fn().mockRejectedValue(new Error('Invalid API key: 401 Unauthorized')),
        initiateVerification: jest.fn().mockRejectedValue(new Error('Invalid API key: 401 Unauthorized')),
      };

      const mockAccount = {
        id: 'account-123',
        tenant_id: tenantId,
        email: 'test@example.com',
        verification_status: 'pending',
        getFullName: jest.fn().mockReturnValue('Test User'),
        getDisplayName: jest.fn().mockReturnValue('Test User'),
      };

      const mockVerification = {
        id: 'verification-123',
        tenant_id: tenantId,
        account_id: 'account-123',
        provider_id: 'mock-provider',
        status: 'rejected',
        error_message: 'Invalid API key: 401 Unauthorized',
      };

      // Mock the dependencies
      mockProvidersFactory.getPrimaryProviderConfig.mockResolvedValue(mockProviderConfig);
      mockProvidersFactory.getProviderById.mockResolvedValue(mockProvider);
      mockAccountRepository.findOne.mockResolvedValue(null);
      mockAccountRepository.create.mockReturnValue(mockAccount);
      mockAccountRepository.save.mockResolvedValue(mockAccount);
      mockVerificationRepository.create.mockReturnValue(mockVerification);
      mockVerificationRepository.save.mockResolvedValue(mockVerification);

      // Act & Assert
      await expect(service.createVerification(tenantId, createVerificationDto))
        .rejects.toThrow('Invalid API key: 401 Unauthorized');
    });

    it('should handle missing provider configuration', async () => {
      // Arrange
      const tenantId = 'test-tenant-id';
      const createVerificationDto: CreateVerificationDto = {
        verificationType: 'document',
        userEmail: 'test@example.com',
      };

      // Mock no provider configuration found
      mockProvidersFactory.getPrimaryProviderConfig.mockResolvedValue(null as any);

      // Act & Assert
      await expect(service.createVerification(tenantId, createVerificationDto))
        .rejects.toThrow('Cannot read properties of null (reading \'provider_id\')');
    });
  });
});
