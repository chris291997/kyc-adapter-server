import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantService } from './tenant.service';
import { Tenant } from '../database/entities/tenant.entity';
import { Verification } from '../database/entities/verification.entity';
import { ApiKey } from '../database/entities/api-key.entity';
import { User } from '../database/entities/user.entity';

describe('TenantService', () => {
  let service: TenantService;
  let tenantRepository: Repository<Tenant>;
  let verificationRepository: Repository<Verification>;
  let apiKeyRepository: Repository<ApiKey>;
  let userRepository: Repository<User>;

  const mockTenantRepository = {
    findOne: jest.fn(),
    count: jest.fn(),
  };

  const mockVerificationRepository = {
    count: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
  };

  const mockApiKeyRepository = {
    find: jest.fn(),
  };

  const mockUserRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
        {
          provide: getRepositoryToken(Verification),
          useValue: mockVerificationRepository,
        },
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockApiKeyRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    tenantRepository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
    verificationRepository = module.get<Repository<Verification>>(getRepositoryToken(Verification));
    apiKeyRepository = module.get<Repository<ApiKey>>(getRepositoryToken(ApiKey));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return tenant dashboard statistics', async () => {
      const tenantId = 'tenant-123';
      const mockTenant = { quota_limit: 1000 };

      mockVerificationRepository.count
        .mockResolvedValueOnce(50)  // total
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(35) // approved
        .mockResolvedValueOnce(5)  // rejected
        .mockResolvedValueOnce(2)  // needs review
        .mockResolvedValueOnce(2); // active tenants

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.getDashboardStats(tenantId);

      expect(result).toEqual({
        verifications: {
          total: 50,
          pending: 10,
          approved: 35,
          rejected: 5,
          needsReview: 2,
        },
        quota: {
          used: 2,
          limit: 1000,
          remaining: 998,
        },
      });
    });
  });

  describe('getVerifications', () => {
    it('should return paginated verifications for tenant', async () => {
      const tenantId = 'tenant-123';
      const mockVerifications = [
        { id: 'verification-1', status: 'pending' },
        { id: 'verification-2', status: 'approved' },
      ];

      mockVerificationRepository.findAndCount.mockResolvedValue([mockVerifications, 2]);

      const result = await service.getVerifications(tenantId, 1, 10);

      expect(result).toEqual({
        data: mockVerifications,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter verifications by status', async () => {
      const tenantId = 'tenant-123';
      const status = 'pending';
      const mockVerifications = [
        { id: 'verification-1', status: 'pending' },
      ];

      mockVerificationRepository.findAndCount.mockResolvedValue([mockVerifications, 1]);

      const result = await service.getVerifications(tenantId, 1, 10, status);

      expect(mockVerificationRepository.findAndCount).toHaveBeenCalledWith({
        where: { tenant_id: tenantId, status: 'pending' },
        skip: 0,
        take: 10,
        order: { created_at: 'DESC' },
        relations: ['provider'],
      });
    });
  });

  describe('getVerification', () => {
    it('should return specific verification for tenant', async () => {
      const tenantId = 'tenant-123';
      const verificationId = 'verification-123';
      const mockVerification = {
        id: verificationId,
        tenant_id: tenantId,
        status: 'approved',
        provider: { name: 'Test Provider' },
        documents: [],
      };

      mockVerificationRepository.findOne.mockResolvedValue(mockVerification);

      const result = await service.getVerification(tenantId, verificationId);

      expect(result).toEqual(mockVerification);
      expect(mockVerificationRepository.findOne).toHaveBeenCalledWith({
        where: { id: verificationId, tenant_id: tenantId },
        relations: ['provider', 'documents'],
      });
    });
  });

  describe('getApiKeys', () => {
    it('should return all API keys for tenant users', async () => {
      const tenantId = 'tenant-123';
      const mockUsers = [
        {
          id: 'user-1',
          name: 'Admin User',
          email: 'admin@test.com',
          api_keys: [
            {
              id: 'api-key-1',
              name: 'API Key 1',
              created_at: new Date('2023-01-01'),
            },
            {
              id: 'api-key-2',
              name: 'API Key 2',
              created_at: new Date('2023-01-02'),
            },
          ],
        },
        {
          id: 'user-2',
          name: 'Regular User',
          email: 'user@test.com',
          api_keys: [
            {
              id: 'api-key-3',
              name: 'API Key 3',
              created_at: new Date('2023-01-03'),
            },
          ],
        },
      ];

      mockUserRepository.find.mockResolvedValue(mockUsers);

      const result = await service.getApiKeys(tenantId);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 'api-key-3',
        name: 'API Key 3',
        created_at: new Date('2023-01-03'),
        user_name: 'Regular User',
        user_email: 'user@test.com',
      });
      expect(result[1]).toEqual({
        id: 'api-key-2',
        name: 'API Key 2',
        created_at: new Date('2023-01-02'),
        user_name: 'Admin User',
        user_email: 'admin@test.com',
      });
    });

    it('should return empty array when no users found', async () => {
      const tenantId = 'tenant-123';
      mockUserRepository.find.mockResolvedValue([]);

      const result = await service.getApiKeys(tenantId);

      expect(result).toEqual([]);
    });
  });
});
