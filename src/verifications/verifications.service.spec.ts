import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VerificationsService } from './verifications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verification } from '../database/entities/verification.entity';
import { VerificationDocument } from '../database/entities/verification-document.entity';
import { Account } from '../database/entities/account.entity';
import { ProvidersFactory } from '../providers/providers.factory';
import { EventPublisher } from '../websocket/event-publisher.service';
import { IDmetaProvider } from '../providers/implementations/idmeta/idmeta.provider';
import { FileStorageService } from '../common/file-storage.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { PhLtoDriversLicenseDto } from './dto/ph-lto-drivers-license.dto';
import { PhNationalPoliceDto } from './dto/ph-national-police.dto';
import { PhNbiDto } from './dto/ph-nbi.dto';
import { PhPrcDto } from './dto/ph-prc.dto';
import { PhSssDto } from './dto/ph-sss.dto';
import { BiometricsFaceMatchDto } from './dto/biometrics-face-match.dto';
import { BiometricsRegistrationDto } from './dto/biometrics-registration.dto';
import { BiometricVerificationDto } from './dto/biometric-verification.dto';
import { CustomDocumentDto } from './dto/custom-document.dto';
import { FinalizeVerificationDto } from './dto/finalize-verification.dto';
import { ManualFinalizeVerificationDto } from './dto/manual-finalize-verification.dto';

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
    getPrimaryProviderForTenant: jest.fn(),
    getPrimaryProviderConfig: jest.fn(),
    getProviderById: jest.fn(),
  };

  const mockEventPublisher = {
    publishProgress: jest.fn().mockResolvedValue(undefined),
    publishCompleted: jest.fn().mockResolvedValue(undefined),
  };

  const mockFileStorageService = {
    saveBase64Image: jest.fn(),
    deleteFile: jest.fn(),
    deleteVerificationFiles: jest.fn(),
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
        {
          provide: EventPublisher,
          useValue: mockEventPublisher,
        },
        {
          provide: FileStorageService,
          useValue: mockFileStorageService,
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
      mockProvidersFactory.getPrimaryProviderForTenant.mockResolvedValue({
        assignment: mockProviderConfig,
        provider: { id: 'mock-provider', ...mockProviderConfig.config },
      });
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
      expect(mockProvidersFactory.getPrimaryProviderForTenant).toHaveBeenCalledWith(tenantId);
      expect(mockProvidersFactory.getProviderById).toHaveBeenCalledWith('mock-provider');
      expect(mockProvider.createVerification).toHaveBeenCalled();
      // Account creation is no longer done in createVerification - accounts are only created after finalize-verification if status is 'verified'
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
      mockProvidersFactory.getPrimaryProviderForTenant.mockResolvedValue({
        assignment: mockProviderConfig,
        provider: { id: 'mock-provider', ...mockProviderConfig.config },
      });
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
      mockProvidersFactory.getPrimaryProviderForTenant.mockResolvedValue(null as any);

      // Act & Assert
      await expect(service.createVerification(tenantId, createVerificationDto))
        .rejects.toThrow();
    });
  });

  describe('Philippines Government Data Verification', () => {
    const tenantId = 'test-tenant-id';
    const verificationId = 'verification-123';
    const externalVerificationId = 'idmeta-verification-456';

    const mockVerification: Partial<Verification> = {
      id: verificationId,
      tenant_id: tenantId,
      account_id: 'account-123',
      provider_id: 'idmeta-provider',
      status: 'pending',
      external_verification_id: externalVerificationId,
      user_metadata: {},
      metadata: {},
    };

    const mockProviderEntity = {
      id: 'idmeta-provider',
      name: 'IDmeta',
      type: 'multi_step',
      api_key: 'test-api-key',
      secret_key: 'test-secret-key',
      webhook_secret: 'test-webhook-secret',
      base_url: 'https://integrate.idmetagroup.com/api',
      api_version: 'v1',
      config: { timeout: 30000, retryAttempts: 3 },
    };

    const mockAssignment = {
      tenant_overrides: {},
    };

    // Create a proper mock that extends IDmetaProvider
    const mockIDmetaProvider = Object.create(IDmetaProvider.prototype);
    Object.assign(mockIDmetaProvider, {
      isInitialized: false,
      initialize: jest.fn().mockResolvedValue(undefined),
      verifyPhLtoDriversLicense: jest.fn(),
      verifyPhNationalPolice: jest.fn(),
    verifyPhNbi: jest.fn(),
    verifyPhPrc: jest.fn(),
    verifyPhSss: jest.fn(),
      biometricsFaceMatch: jest.fn(),
      biometricsRegistration: jest.fn(),
      biometricVerification: jest.fn(),
      finalizeVerification: jest.fn(),
      manualFinalizeVerification: jest.fn(),
      customDocument: jest.fn(),
    });

    beforeEach(() => {
      jest.clearAllMocks();
      mockVerificationRepository.findOne.mockResolvedValue(mockVerification);
      mockVerificationRepository.update.mockResolvedValue({ affected: 1 });
      mockProvidersFactory.getPrimaryProviderForTenant.mockResolvedValue({
        assignment: mockAssignment,
        provider: mockProviderEntity,
      });
      mockProvidersFactory.getProviderById.mockResolvedValue(mockIDmetaProvider);
      mockAccountRepository.findOne.mockResolvedValue({
        id: 'account-123',
        tenant_id: tenantId,
      });
      mockAccountRepository.save.mockResolvedValue({});
    });

    describe('verifyPhLtoDriversLicense', () => {
      const dto: PhLtoDriversLicenseDto = {
        verificationId,
        templateId: '425',
        licenseNo: 'N01-12-345678',
      };

      it('should successfully verify LTO drivers license', async () => {
        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: { status: 3, status_message: 'VERIFIED' },
            parsedResult: {
              data: {
                license_no: 'N01-12-345678',
                name: 'Juan DELA CRUZ',
              },
            },
          },
        };

        (mockIDmetaProvider.verifyPhLtoDriversLicense as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.verifyPhLtoDriversLicense(tenantId, dto);

        expect(result).toEqual({ id: verificationId, status: 'approved' });
        expect(mockIDmetaProvider.initialize).toHaveBeenCalled();
        expect(mockIDmetaProvider.verifyPhLtoDriversLicense).toHaveBeenCalledWith({
          licenseNo: dto.licenseNo,
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
        expect(mockVerificationRepository.update).toHaveBeenCalled();
        expect(mockEventPublisher.publishProgress).toHaveBeenCalledWith(verificationId, 'ph_lto_verification', 25);
        expect(mockEventPublisher.publishCompleted).toHaveBeenCalled();
      });

      it('should throw error if provider is not IDmeta', async () => {
        const mockOtherProvider = { name: 'OtherProvider' };
        mockProvidersFactory.getProviderById.mockResolvedValue(mockOtherProvider);

        await expect(service.verifyPhLtoDriversLicense(tenantId, dto))
          .rejects.toThrow(BadRequestException);

        expect(mockIDmetaProvider.verifyPhLtoDriversLicense).not.toHaveBeenCalled();
      });

      it('should throw error if verification not initialized with IDmeta', async () => {
        const verificationWithoutExternalId = {
          ...mockVerification,
          external_verification_id: null,
        };
        mockVerificationRepository.findOne.mockResolvedValue(verificationWithoutExternalId);

        await expect(service.verifyPhLtoDriversLicense(tenantId, dto))
          .rejects.toThrow(BadRequestException);

        expect(mockIDmetaProvider.verifyPhLtoDriversLicense).not.toHaveBeenCalled();
      });

      it('should handle rejected verification status', async () => {
        const mockResult = {
          status: 'rejected',
          providerData: {
            fullResponse: { status: 1, status_message: 'REJECTED' },
            parsedResult: { error: 'License not found' },
          },
        };

        (mockIDmetaProvider.verifyPhLtoDriversLicense as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.verifyPhLtoDriversLicense(tenantId, dto);

        expect(result.status).toBe('rejected');
        expect(mockVerificationRepository.update).toHaveBeenCalledWith(
          verificationId,
          expect.objectContaining({ status: 'rejected' })
        );
      });
    });

    describe('verifyPhNationalPolice', () => {
      const dto: PhNationalPoliceDto = {
        verificationId,
        templateId: '425',
        surname: 'DELA CRUZ',
        clearanceNo: 'NP-123456-2024',
      };

      it('should successfully verify National Police clearance', async () => {
        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: { status: 3 },
            parsedResult: {
              data: {
                clearance_no: 'NP-123456-2024',
                surname: 'DELA CRUZ',
              },
            },
          },
        };

        (mockIDmetaProvider.verifyPhNationalPolice as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.verifyPhNationalPolice(tenantId, dto);

        expect(result).toEqual({ id: verificationId, status: 'approved' });
        expect(mockIDmetaProvider.verifyPhNationalPolice).toHaveBeenCalledWith({
          surname: dto.surname,
          clearanceNo: dto.clearanceNo,
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
        expect(mockEventPublisher.publishProgress).toHaveBeenCalledWith(
          verificationId,
          'ph_national_police_verification',
          25
        );
      });

      it('should throw error if provider is not IDmeta', async () => {
        const mockOtherProvider = { name: 'OtherProvider' };
        mockProvidersFactory.getProviderById.mockResolvedValue(mockOtherProvider);

        await expect(service.verifyPhNationalPolice(tenantId, dto))
          .rejects.toThrow(BadRequestException);
      });
    });

    describe('verifyPhNbi', () => {
      const dto: PhNbiDto = {
        verificationId,
        templateId: '425',
        clearanceNo: 'N-1234567890-2024',
      };

      it('should successfully verify NBI clearance', async () => {
        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: { status: 'VERIFIED' },
            parsedResult: {
              data: {
                clearance_no: 'N-1234567890-2024',
              },
            },
          },
        };

        (mockIDmetaProvider.verifyPhNbi as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.verifyPhNbi(tenantId, dto);

        expect(result).toEqual({ id: verificationId, status: 'approved' });
        expect(mockIDmetaProvider.verifyPhNbi).toHaveBeenCalledWith({
          clearanceNo: dto.clearanceNo,
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
        expect(mockEventPublisher.publishProgress).toHaveBeenCalledWith(
          verificationId,
          'ph_nbi_verification',
          25
        );
      });

      it('should handle processing status', async () => {
        const mockResult = {
          status: 'processing',
          providerData: {
            fullResponse: { status: 2 },
            parsedResult: {},
          },
        };

        (mockIDmetaProvider.verifyPhNbi as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.verifyPhNbi(tenantId, dto);

        expect(result.status).toBe('processing');
      });
    });

    describe('verifyPhPrc', () => {
      it('should successfully verify PRC by license number', async () => {
        const dto: PhPrcDto = {
          verificationId,
          templateId: '425',
          profession: 'Engineer',
          licenseNo: '123456',
          dateOfBirth: '1990-01-01',
        };

        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: { status: 3 },
            parsedResult: {
              data: {
                license_no: '123456',
                profession: 'Engineer',
              },
            },
          },
        };

        (mockIDmetaProvider.verifyPhPrc as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.verifyPhPrc(tenantId, dto);

        expect(result).toEqual({ id: verificationId, status: 'approved' });
        expect(mockIDmetaProvider.verifyPhPrc).toHaveBeenCalledWith({
          profession: dto.profession,
          licenseNo: dto.licenseNo,
          dateOfBirth: dto.dateOfBirth,
          firstName: undefined,
          lastName: undefined,
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
        expect(mockEventPublisher.publishProgress).toHaveBeenCalledWith(
          verificationId,
          'ph_prc_verification',
          25
        );
      });

      it('should successfully verify PRC by name', async () => {
        const dto: PhPrcDto = {
          verificationId,
          templateId: '425',
          profession: 'Engineer',
          firstName: 'Juan',
          lastName: 'DELA CRUZ',
        };

        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: { status: 3 },
            parsedResult: { data: {} },
          },
        };

        (mockIDmetaProvider.verifyPhPrc as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.verifyPhPrc(tenantId, dto);

        expect(result.status).toBe('approved');
        expect(mockIDmetaProvider.verifyPhPrc).toHaveBeenCalledWith({
          profession: dto.profession,
          licenseNo: undefined,
          dateOfBirth: undefined,
          firstName: dto.firstName,
          lastName: dto.lastName,
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
      });

      it('should throw error if neither search method is provided', async () => {
        const dto: PhPrcDto = {
          verificationId,
          templateId: '425',
          profession: 'Engineer',
          // Missing both licenseNo+dateOfBirth AND firstName+lastName
        };

        await expect(service.verifyPhPrc(tenantId, dto))
          .rejects.toThrow(BadRequestException);

        expect(mockIDmetaProvider.verifyPhPrc).not.toHaveBeenCalled();
      });

      it('should throw error if only partial license search is provided', async () => {
        const dto: PhPrcDto = {
          verificationId,
          templateId: '425',
          profession: 'Engineer',
          licenseNo: '123456',
          // Missing dateOfBirth
        };

        await expect(service.verifyPhPrc(tenantId, dto))
          .rejects.toThrow(BadRequestException);
      });

      it('should throw error if only partial name search is provided', async () => {
        const dto: PhPrcDto = {
          verificationId,
          templateId: '425',
          profession: 'Engineer',
          firstName: 'Juan',
          // Missing lastName
        };

        await expect(service.verifyPhPrc(tenantId, dto))
          .rejects.toThrow(BadRequestException);
      });
    });

    describe('verifyPhSss', () => {
      const dto: PhSssDto = {
        verificationId,
        templateId: '425',
        crnSsNumber: '34-1234567-8',
      };

      it('should successfully verify SSS number', async () => {
        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: { status: 'VERIFIED' },
            parsedResult: {
              data: {
                crn_ss_number: '34-1234567-8',
              },
            },
          },
        };

        (mockIDmetaProvider.verifyPhSss as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.verifyPhSss(tenantId, dto);

        expect(result).toEqual({ id: verificationId, status: 'approved' });
        expect(mockIDmetaProvider.verifyPhSss).toHaveBeenCalledWith({
          crnSsNumber: dto.crnSsNumber,
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
        expect(mockEventPublisher.publishProgress).toHaveBeenCalledWith(
          verificationId,
          'ph_sss_verification',
          25
        );
      });

      it('should handle rejected status', async () => {
        const mockResult = {
          status: 'rejected',
          providerData: {
            fullResponse: { status: 'REJECTED' },
            parsedResult: { error: 'SSS number not found' },
          },
        };

        (mockIDmetaProvider.verifyPhSss as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.verifyPhSss(tenantId, dto);

        expect(result.status).toBe('rejected');
      });
    });

    describe('biometricsFaceMatch', () => {
      const dto: BiometricsFaceMatchDto = {
        verificationId,
        templateId: '425',
        image1: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
        image2: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      };

      it('should successfully perform biometrics face match', async () => {
        const mockResult = {
          status: 'processing',
          providerData: {
            fullResponse: { status: true, message: 'OK' },
            result: { status: 'success', score: 99 },
            score: 99,
          },
        };

        mockFileStorageService.saveBase64Image.mockResolvedValue({
          url: '/uploads/verifications/test/image1.jpg',
          path: '/path/to/image1.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
        });

        (mockIDmetaProvider.biometricsFaceMatch as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.biometricsFaceMatch(tenantId, dto);

        // Biometrics operations are async - return 'processing' and wait for webhook
        expect(result).toEqual({ id: verificationId, status: 'processing' });
        expect(mockIDmetaProvider.initialize).toHaveBeenCalled();
        expect(mockIDmetaProvider.biometricsFaceMatch).toHaveBeenCalledWith({
          image1: dto.image1,
          image2: dto.image2,
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
        expect(mockVerificationRepository.update).toHaveBeenCalledWith(
          verificationId,
          expect.objectContaining({ status: 'processing' })
        );
        expect(mockEventPublisher.publishProgress).toHaveBeenCalledWith(verificationId, 'biometrics_face_match', 25);
        expect(mockEventPublisher.publishCompleted).toHaveBeenCalled();
      });

      it('should throw error if provider is not IDmeta', async () => {
        const mockOtherProvider = { name: 'OtherProvider' };
        mockProvidersFactory.getProviderById.mockResolvedValue(mockOtherProvider);

        await expect(service.biometricsFaceMatch(tenantId, dto))
          .rejects.toThrow(BadRequestException);

        expect(mockIDmetaProvider.biometricsFaceMatch).not.toHaveBeenCalled();
      });

      it('should handle rejected face match (low score)', async () => {
        const mockResult = {
          status: 'rejected',
          providerData: {
            fullResponse: { status: true, message: 'OK' },
            result: { status: 'success', score: 45 },
            score: 45,
          },
        };

        mockFileStorageService.saveBase64Image.mockResolvedValue({
          url: '/uploads/verifications/test/image1.jpg',
          path: '/path/to/image1.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
        });

        (mockIDmetaProvider.biometricsFaceMatch as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.biometricsFaceMatch(tenantId, dto);

        expect(result.status).toBe('rejected');
        expect(mockVerificationRepository.update).toHaveBeenCalledWith(
          verificationId,
          expect.objectContaining({ status: 'rejected' })
        );
      });
    });

    describe('biometricsRegistration', () => {
      const dto: BiometricsRegistrationDto = {
        verificationId,
        templateId: '425',
        username: 'John Doe',
        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
      };

      it('should successfully register biometrics', async () => {
        const mockResult = {
          status: 'processing',
          providerData: {
            fullResponse: { status: true, message: 'OK' },
            result: {
              status: 'success',
              message: 'Biometrics registration successful.',
              result: {
                associatedVerificationId: '1234567890abcdef',
                faceId: 'face_abc123xyz',
                imageUrl: 'https://example.com/faces/face_abc123xyz.jpg',
                timestamp: '2025-07-30T09:15:00Z',
              },
            },
            apiRequest: { id: 101 },
          },
        };

        mockFileStorageService.saveBase64Image.mockResolvedValue({
          url: '/uploads/verifications/test/image.jpg',
          path: '/path/to/image.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
        });

        (mockIDmetaProvider.biometricsRegistration as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.biometricsRegistration(tenantId, dto);

        // Biometrics operations are async - return 'processing' and wait for webhook
        expect(result).toEqual({ id: verificationId, status: 'processing' });
        expect(mockIDmetaProvider.initialize).toHaveBeenCalled();
        expect(mockIDmetaProvider.biometricsRegistration).toHaveBeenCalledWith({
          username: dto.username,
          image: dto.image,
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
        expect(mockVerificationRepository.update).toHaveBeenCalledWith(
          verificationId,
          expect.objectContaining({ status: 'processing' })
        );
        expect(mockEventPublisher.publishProgress).toHaveBeenCalledWith(verificationId, 'biometrics_registration', 25);
        expect(mockEventPublisher.publishCompleted).toHaveBeenCalled();
      });

      it('should throw error if provider is not IDmeta', async () => {
        const mockOtherProvider = { name: 'OtherProvider' };
        mockProvidersFactory.getProviderById.mockResolvedValue(mockOtherProvider);

        await expect(service.biometricsRegistration(tenantId, dto))
          .rejects.toThrow(BadRequestException);

        expect(mockIDmetaProvider.biometricsRegistration).not.toHaveBeenCalled();
      });

      it('should handle rejected registration', async () => {
        const mockResult = {
          status: 'rejected',
          providerData: {
            fullResponse: { status: false, message: 'Failed' },
            result: { status: 'failed', message: 'Face not detected' },
          },
        };

        mockFileStorageService.saveBase64Image.mockResolvedValue({
          url: '/uploads/verifications/test/image.jpg',
          path: '/path/to/image.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
        });

        (mockIDmetaProvider.biometricsRegistration as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.biometricsRegistration(tenantId, dto);

        expect(result.status).toBe('rejected');
        expect(mockVerificationRepository.update).toHaveBeenCalledWith(
          verificationId,
          expect.objectContaining({ status: 'rejected' })
        );
      });
    });

    describe('biometricVerification', () => {
      const dto: BiometricVerificationDto = {
        verificationId,
        templateId: '425',
        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
        imageBase64: 'dGVzdGltYWdlYmFzZTY0',
      };

      it('should successfully perform biometric verification', async () => {
        const mockResult = {
          status: 'processing',
          providerData: {
            fullResponse: { status: true, message: 'OK' },
            result: {
              status: 'success',
              probability: 0.987,
              message: 'Biometrics match successful',
              faceId: 'face_xyz123abc',
              timestamp: '2025-07-30T01:05:00Z',
            },
            apiRequest: { id: 456 },
            probability: 0.987,
            faceId: 'face_xyz123abc',
          },
        };

        mockFileStorageService.saveBase64Image.mockResolvedValue({
          url: '/uploads/verifications/test/image.jpg',
          path: '/path/to/image.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
        });

        (mockIDmetaProvider.biometricVerification as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.biometricVerification(tenantId, dto);

        // Biometrics operations are async - return 'processing' and wait for webhook
        expect(result).toEqual({ id: verificationId, status: 'processing' });
        expect(mockIDmetaProvider.initialize).toHaveBeenCalled();
        expect(mockIDmetaProvider.biometricVerification).toHaveBeenCalledWith({
          image: dto.image,
          imageBase64: dto.imageBase64,
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
        expect(mockVerificationRepository.update).toHaveBeenCalledWith(
          verificationId,
          expect.objectContaining({ status: 'processing' })
        );
        expect(mockEventPublisher.publishProgress).toHaveBeenCalledWith(verificationId, 'biometric_verification', 25);
        expect(mockEventPublisher.publishCompleted).toHaveBeenCalled();
      });

      it('should throw error if provider is not IDmeta', async () => {
        const mockOtherProvider = { name: 'OtherProvider' };
        mockProvidersFactory.getProviderById.mockResolvedValue(mockOtherProvider);

        await expect(service.biometricVerification(tenantId, dto))
          .rejects.toThrow(BadRequestException);

        expect(mockIDmetaProvider.biometricVerification).not.toHaveBeenCalled();
      });

      it('should handle biometric verification with only image', async () => {
        const dtoWithImageOnly: BiometricVerificationDto = {
          verificationId,
          templateId: '425',
          image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
        };

        const mockResult = {
          status: 'processing',
          providerData: {
            fullResponse: { status: true, message: 'OK' },
            result: {
              status: 'success',
              probability: 0.95,
            },
            probability: 0.95,
          },
        };

        mockFileStorageService.saveBase64Image.mockResolvedValue({
          url: '/uploads/verifications/test/image.jpg',
          path: '/path/to/image.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
        });

        (mockIDmetaProvider.biometricVerification as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.biometricVerification(tenantId, dtoWithImageOnly);

        // Biometrics operations are async - return 'processing' and wait for webhook
        expect(result.status).toBe('processing');
        expect(mockIDmetaProvider.biometricVerification).toHaveBeenCalledWith({
          image: dtoWithImageOnly.image,
          imageBase64: undefined,
          templateId: dtoWithImageOnly.templateId,
          verificationId: externalVerificationId,
        });
      });

      it('should handle rejected biometric verification', async () => {
        const mockResult = {
          status: 'rejected',
          providerData: {
            fullResponse: { status: false, message: 'Failed' },
            result: {
              status: 'failed',
              message: 'Face verification failed. FACE_NOT_FOUND',
              code: 0,
            },
          },
        };

        mockFileStorageService.saveBase64Image.mockResolvedValue({
          url: '/uploads/verifications/test/image.jpg',
          path: '/path/to/image.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
        });

        (mockIDmetaProvider.biometricVerification as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.biometricVerification(tenantId, dto);

        expect(result.status).toBe('rejected');
        expect(mockVerificationRepository.update).toHaveBeenCalledWith(
          verificationId,
          expect.objectContaining({ status: 'rejected' })
        );
      });
    });

    describe('customDocument', () => {
      const dto: CustomDocumentDto = {
        verificationId,
        templateId: '425',
        document: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...==',
      };

      it('should successfully verify custom document', async () => {
        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: { status: true, message: 'OK' },
            result: {
              formData: {
                name: 'Michael Reyes',
                idnumber: 'ASIC764839201',
                address: '45 Bonifacio St, Pasay City, Metro Manila, Philippines',
                birthdate: '26-02-2003',
                gender: 'Male',
                date_of_issue: '22-07-2025',
              },
            },
            formData: {
              name: 'Michael Reyes',
              idnumber: 'ASIC764839201',
            },
          },
        };

        (mockIDmetaProvider.customDocument as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.customDocument(tenantId, dto);

        expect(result).toEqual({ id: verificationId, status: 'approved' });
        expect(mockIDmetaProvider.initialize).toHaveBeenCalled();
        expect(mockIDmetaProvider.customDocument).toHaveBeenCalledWith({
          document: dto.document,
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
        expect(mockVerificationRepository.update).toHaveBeenCalled();
        expect(mockEventPublisher.publishProgress).toHaveBeenCalledWith(verificationId, 'custom_document', 25);
        expect(mockEventPublisher.publishCompleted).toHaveBeenCalled();
      });

      it('should throw error if provider is not IDmeta', async () => {
        const mockOtherProvider = { name: 'OtherProvider' };
        mockProvidersFactory.getProviderById.mockResolvedValue(mockOtherProvider);

        await expect(service.customDocument(tenantId, dto))
          .rejects.toThrow(BadRequestException);

        expect(mockIDmetaProvider.customDocument).not.toHaveBeenCalled();
      });

      it('should handle custom document without document parameter', async () => {
        const dtoWithoutDocument: CustomDocumentDto = {
          verificationId,
          templateId: '425',
        };

        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: { status: true, message: 'OK' },
            result: { formData: {} },
            formData: {},
          },
        };

        (mockIDmetaProvider.customDocument as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.customDocument(tenantId, dtoWithoutDocument);

        expect(result.status).toBe('approved');
        expect(mockIDmetaProvider.customDocument).toHaveBeenCalledWith({
          document: undefined,
          templateId: dtoWithoutDocument.templateId,
          verificationId: externalVerificationId,
        });
      });

      it('should handle rejected custom document', async () => {
        const mockResult = {
          status: 'rejected',
          providerData: {
            fullResponse: { status: false, message: 'Failed' },
            result: { formData: null },
            formData: null,
          },
        };

        (mockIDmetaProvider.customDocument as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.customDocument(tenantId, dto);

        expect(result.status).toBe('rejected');
        expect(mockVerificationRepository.update).toHaveBeenCalledWith(
          verificationId,
          expect.objectContaining({ status: 'rejected' })
        );
      });
    });

    describe('Common Error Scenarios', () => {
      it('should throw NotFoundException if verification not found', async () => {
        mockVerificationRepository.findOne.mockResolvedValue(null);

        const dto: PhLtoDriversLicenseDto = {
          verificationId: 'non-existent',
          templateId: '425',
          licenseNo: 'N01-12-345678',
        };

        await expect(service.verifyPhLtoDriversLicense(tenantId, dto))
          .rejects.toThrow(NotFoundException);
      });

      it('should initialize provider if not already initialized', async () => {
        const uninitializedProvider = Object.create(IDmetaProvider.prototype);
        Object.assign(uninitializedProvider, {
          ...mockIDmetaProvider,
          isInitialized: false,
          initialize: jest.fn().mockResolvedValue(undefined),
          verifyPhLtoDriversLicense: jest.fn().mockResolvedValue({
            status: 'approved',
            providerData: { fullResponse: {}, parsedResult: {} },
          }),
        });
        mockProvidersFactory.getProviderById.mockResolvedValue(uninitializedProvider);

        const dto: PhLtoDriversLicenseDto = {
          verificationId,
          templateId: '425',
          licenseNo: 'N01-12-345678',
        };

        await service.verifyPhLtoDriversLicense(tenantId, dto);

        expect(uninitializedProvider.initialize).toHaveBeenCalled();
      });

      // Note: Account updates are no longer done in individual verification methods
      // Accounts are only saved after finalize-verification if status is 'verified'
      // This test is removed as it's no longer applicable

      it('should not update account if verification has no linked account', async () => {
        const verificationWithoutAccount = {
          ...mockVerification,
          account_id: null,
        };
        mockVerificationRepository.findOne.mockResolvedValue(verificationWithoutAccount);

        const dto: PhLtoDriversLicenseDto = {
          verificationId,
          templateId: '425',
          licenseNo: 'N01-12-345678',
        };

        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: {},
            parsedResult: { data: {} },
          },
        };

        (mockIDmetaProvider.verifyPhLtoDriversLicense as jest.Mock).mockResolvedValue(mockResult);

        await service.verifyPhLtoDriversLicense(tenantId, dto);

        expect(mockAccountRepository.findOne).not.toHaveBeenCalled();
      });

      it('should handle WebSocket publish errors gracefully', async () => {
        mockEventPublisher.publishCompleted.mockRejectedValue(new Error('WebSocket error'));

        const dto: PhLtoDriversLicenseDto = {
          verificationId,
          templateId: '425',
          licenseNo: 'N01-12-345678',
        };

        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: {},
            parsedResult: { data: {} },
          },
        };

        (mockIDmetaProvider.verifyPhLtoDriversLicense as jest.Mock).mockResolvedValue(mockResult);

        // Should not throw, just log warning
        const result = await service.verifyPhLtoDriversLicense(tenantId, dto);

        expect(result).toBeDefined();
        expect(result.status).toBe('approved');
      });
    });

    describe('finalizeVerification', () => {
      const dto: FinalizeVerificationDto = {
        verificationId,
        templateId: '425',
      };

      it('should successfully finalize verification', async () => {
        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: {},
            verification: { id: externalVerificationId, status: 3 },
            missing_plans: [],
            status_message: 'VERIFIED',
            finalized: true,
          },
        };

        (mockIDmetaProvider.finalizeVerification as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.finalizeVerification(tenantId, dto);

        expect(result).toEqual({
          id: verificationId,
          status: 'approved',
          finalized: true,
          statusMessage: 'VERIFIED',
          missingPlans: [],
        });
        expect(mockIDmetaProvider.initialize).toHaveBeenCalled();
        expect(mockIDmetaProvider.finalizeVerification).toHaveBeenCalledWith({
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
        expect(mockVerificationRepository.update).toHaveBeenCalled();
        expect(mockEventPublisher.publishProgress).toHaveBeenCalledWith(verificationId, 'finalize_verification', 50);
        expect(mockEventPublisher.publishCompleted).toHaveBeenCalled();
      });

      it('should throw error if provider is not IDmeta', async () => {
        const mockOtherProvider = {
          isInitialized: true,
          initialize: jest.fn(),
        };
        mockProvidersFactory.getProviderById.mockResolvedValue(mockOtherProvider);

        await expect(service.finalizeVerification(tenantId, dto)).rejects.toThrow(
          BadRequestException
        );
        expect(mockIDmetaProvider.finalizeVerification).not.toHaveBeenCalled();
      });

      it('should throw error if verification not initialized with IDmeta', async () => {
        const verificationWithoutExternalId = {
          ...mockVerification,
          external_verification_id: null,
        };
        mockVerificationRepository.findOne.mockResolvedValue(verificationWithoutExternalId);

        await expect(service.finalizeVerification(tenantId, dto)).rejects.toThrow(
          BadRequestException
        );
        expect(mockIDmetaProvider.finalizeVerification).not.toHaveBeenCalled();
      });

      it('should handle REVIEW_NEEDED status', async () => {
        const mockResult = {
          status: 'processing',
          providerData: {
            fullResponse: {},
            verification: { id: externalVerificationId, status: 2 },
            missing_plans: [],
            status_message: 'REVIEW_NEEDED',
            finalized: true,
          },
        };

        (mockIDmetaProvider.finalizeVerification as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.finalizeVerification(tenantId, dto);

        expect(result.status).toBe('processing');
        expect(result.statusMessage).toBe('REVIEW_NEEDED');
      });

      it('should save account when verification status is verified', async () => {
        const mockResult = {
          status: 'verified',
          providerData: {
            fullResponse: {},
            verification: { id: externalVerificationId, status: 3 },
            missing_plans: [],
            status_message: 'VERIFIED',
            finalized: true,
          },
        };

        // Mock the verification to have 'verified' status after update
        const updatedVerification = {
          ...mockVerification,
          status: 'verified',
          validated_user_data: { firstName: 'John', lastName: 'Doe' },
          provider_response: { verification: { id: externalVerificationId } },
          user_metadata: {},
        };

        (mockIDmetaProvider.finalizeVerification as jest.Mock).mockResolvedValue(mockResult);
        mockVerificationRepository.update.mockResolvedValue({ affected: 1 });
        
        // Mock findOne calls:
        // 1. First call from getVerification (with relations)
        // 2. Second call from finalizeVerification after update (without relations, returns updated verification)
        mockVerificationRepository.findOne
          .mockResolvedValueOnce(mockVerification) // First call: getVerification
          .mockResolvedValueOnce(updatedVerification); // Second call: after update, before saveAccountFromVerification
        
        mockAccountRepository.findOne.mockResolvedValue(null);
        mockAccountRepository.create.mockReturnValue({ id: 'account-123', tenant_id: tenantId } as any);
        mockAccountRepository.save.mockResolvedValue({ id: 'account-123', tenant_id: tenantId } as any);

        await service.finalizeVerification(tenantId, dto);

        // Account should be saved only if verification status is 'verified'
        expect(mockAccountRepository.findOne).toHaveBeenCalled();
        expect(mockAccountRepository.save).toHaveBeenCalled();
      });
    });

    describe('manualFinalizeVerification', () => {
      const dto: ManualFinalizeVerificationDto = {
        verificationId,
        templateId: '425',
      };

      it('should successfully manually finalize verification', async () => {
        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: {},
            verification: { id: externalVerificationId, status: 3 },
            missing_plans: [],
            status_message: 'VERIFIED',
            finalized: true,
          },
        };

        (mockIDmetaProvider.manualFinalizeVerification as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.manualFinalizeVerification(tenantId, dto);

        expect(result).toEqual({
          id: verificationId,
          status: 'approved',
          finalized: true,
          statusMessage: 'VERIFIED',
          missingPlans: [],
        });
        expect(mockIDmetaProvider.initialize).toHaveBeenCalled();
        expect(mockIDmetaProvider.manualFinalizeVerification).toHaveBeenCalledWith({
          templateId: dto.templateId,
          verificationId: externalVerificationId,
        });
        expect(mockVerificationRepository.update).toHaveBeenCalled();
        expect(mockEventPublisher.publishProgress).toHaveBeenCalledWith(verificationId, 'manual_finalize_verification', 50);
        expect(mockEventPublisher.publishCompleted).toHaveBeenCalled();
      });

      it('should throw error if provider is not IDmeta', async () => {
        const mockOtherProvider = {
          isInitialized: true,
          initialize: jest.fn(),
        };
        mockProvidersFactory.getProviderById.mockResolvedValue(mockOtherProvider);

        await expect(service.manualFinalizeVerification(tenantId, dto)).rejects.toThrow(
          BadRequestException
        );
        expect(mockIDmetaProvider.manualFinalizeVerification).not.toHaveBeenCalled();
      });

      it('should throw error if verification not initialized with IDmeta', async () => {
        const verificationWithoutExternalId = {
          ...mockVerification,
          external_verification_id: null,
        };
        mockVerificationRepository.findOne.mockResolvedValue(verificationWithoutExternalId);

        await expect(service.manualFinalizeVerification(tenantId, dto)).rejects.toThrow(
          BadRequestException
        );
        expect(mockIDmetaProvider.manualFinalizeVerification).not.toHaveBeenCalled();
      });

      it('should handle rejected status', async () => {
        const mockResult = {
          status: 'rejected',
          providerData: {
            fullResponse: {},
            verification: { id: externalVerificationId, status: 1 },
            missing_plans: [],
            status_message: 'REJECTED',
            finalized: true,
          },
        };

        (mockIDmetaProvider.manualFinalizeVerification as jest.Mock).mockResolvedValue(mockResult);

        const result = await service.manualFinalizeVerification(tenantId, dto);

        expect(result.status).toBe('rejected');
        expect(result.statusMessage).toBe('REJECTED');
      });

      it('should handle WebSocket publish errors gracefully', async () => {
        mockEventPublisher.publishCompleted.mockRejectedValue(new Error('WebSocket error'));

        const mockResult = {
          status: 'approved',
          providerData: {
            fullResponse: {},
            verification: { id: externalVerificationId, status: 3 },
            missing_plans: [],
            status_message: 'VERIFIED',
            finalized: true,
          },
        };

        (mockIDmetaProvider.manualFinalizeVerification as jest.Mock).mockResolvedValue(mockResult);

        // Should not throw, just log warning
        const result = await service.manualFinalizeVerification(tenantId, dto);

        expect(result).toBeDefined();
        expect(result.status).toBe('approved');
      });
    });
  });
});
