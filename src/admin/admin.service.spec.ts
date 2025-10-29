import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { User } from '../database/entities/user.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { Provider } from '../database/entities/provider.entity';
import { Verification } from '../database/entities/verification.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

describe('AdminService', () => {
  let service: AdminService;
  let userRepository: Repository<User>;
  let tenantRepository: Repository<Tenant>;
  let providerRepository: Repository<Provider>;
  let verificationRepository: Repository<Verification>;

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockTenantRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };

  const mockProviderRepository = {
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockVerificationRepository = {
    count: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockTenantProviderConfigRepository: any = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
        {
          provide: getRepositoryToken(Provider),
          useValue: mockProviderRepository,
        },
        {
          provide: getRepositoryToken(Verification),
          useValue: mockVerificationRepository,
        },
        {
          provide: getRepositoryToken(require('../database/entities/tenant-provider-config.entity').TenantProviderConfig),
          useValue: mockTenantProviderConfigRepository,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    tenantRepository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
    providerRepository = module.get<Repository<Provider>>(getRepositoryToken(Provider));
    verificationRepository = module.get<Repository<Verification>>(getRepositoryToken(Verification));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      mockTenantRepository.count
        .mockResolvedValueOnce(5)  // total tenants
        .mockResolvedValueOnce(5)  // active tenants
        .mockResolvedValueOnce(0); // suspended tenants
      mockProviderRepository.count.mockResolvedValue(3);
      mockVerificationRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20)  // pending
        .mockResolvedValueOnce(70) // approved
        .mockResolvedValueOnce(10) // rejected
        .mockResolvedValueOnce(2); // active tenants

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        tenants: {
          total: 5,
          active: 5,
          suspended: 0,
        },
        providers: {
          total: 3,
          active: expect.any(Number),
        },
        verifications: {
          total: 100,
          pending: 20,
          approved: 70,
          rejected: 10,
        },
      });
    });
  });

  describe('getTenantProviderConfigs', () => {
    it('should map webhook metadata on provider configs', async () => {
      const provider = { id: 'prov-1', name: 'IDMeta', type: 'multi_step', base_url: 'https://x', api_version: 'v1', is_active: true };
      const cfgs = [
        { id: 'cfg-1', tenant_id: 'tenant-123', provider, config: { apiKey: 'x', webhookSecret: 'secret' }, priority: 1, is_enabled: true, created_at: new Date(), updated_at: new Date() },
      ];
      mockTenantProviderConfigRepository.find.mockResolvedValue(cfgs);

      const result = await service.getTenantProviderConfigs('tenant-123');

      expect(result[0].webhook_endpoint).toBe(`/v1/webhook/${provider.name.toLowerCase()}`);
      expect(result[0].webhook_secret_set).toBe(true);
    });
  });

  describe('updateTenantProviderConfig', () => {
    it('should merge config safely without overwriting existing keys', async () => {
      const provider = { id: 'prov-1', name: 'IDMeta' } as any;
      const existing = { id: 'cfg-1', tenant_id: 'tenant-123', provider, tenant_overrides: { timeout: 1000 }, priority: 1, is_enabled: true } as any;
      mockTenantProviderConfigRepository.findOne.mockResolvedValue(existing);
      mockTenantProviderConfigRepository.save.mockImplementation(async (c: any) => c);

      const result = await service.updateTenantProviderConfig('tenant-123', 'cfg-1', {
        tenant_overrides: { timeout: 3000 }
      } as any);

      expect(result.tenant_overrides).toEqual({ timeout: 3000 });
    });
  });

  describe('createTenant', () => {
    it('should create tenant and admin user successfully', async () => {
      const createTenantDto: CreateTenantDto = {
        name: 'Test Company',
        email: 'admin@testcompany.com',
        password: 'TestPassword123',
        quotaLimit: 1000,
      };

      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        email: 'admin@testcompany.com',
        quota_limit: 1000,
      };

      const mockUser = {
        id: 'user-123',
        email: 'admin@testcompany.com',
        name: 'Test Company',
        user_type: 'tenant_admin',
        tenant_id: 'tenant-123',
      };

      mockTenantRepository.findOne.mockResolvedValue(null);
      mockTenantRepository.create.mockReturnValue(mockTenant);
      mockTenantRepository.save.mockResolvedValue(mockTenant);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      jest.spyOn(require('bcryptjs'), 'hash').mockResolvedValue('hashed-password');

      const result = await service.createTenant(createTenantDto);

      expect(result).toEqual({
        ...mockTenant,
        admin_user: {
          id: 'user-123',
          email: 'admin@testcompany.com',
          name: 'Test Company',
          user_type: 'tenant_admin',
        },
      });
    });

    it('should throw ConflictException when tenant email already exists', async () => {
      const createTenantDto: CreateTenantDto = {
        name: 'Test Company',
        email: 'existing@testcompany.com',
        password: 'TestPassword123',
      };

      mockTenantRepository.findOne.mockResolvedValue({ id: 'existing-tenant' });

      await expect(service.createTenant(createTenantDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('getTenant', () => {
    it('should return tenant with users and accounts', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        email: 'admin@testcompany.com',
        users: [{ id: 'user-123', name: 'Admin User' }],
        accounts: [{ id: 'account-123', email: 'user@example.com' }],
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.getTenant('tenant-123');

      expect(result).toEqual(mockTenant);
      expect(mockTenantRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        relations: ['users', 'accounts'],
      });
    });

    it('should throw NotFoundException when tenant not found', async () => {
      mockTenantRepository.findOne.mockResolvedValue(null);

      await expect(service.getTenant('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTenant', () => {
    it('should update tenant successfully', async () => {
      const updateTenantDto: UpdateTenantDto = {
        name: 'Updated Company',
        quota_limit: 2000,
      };

      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        quota_limit: 1000,
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockTenantRepository.save.mockResolvedValue({ ...mockTenant, ...updateTenantDto });

      const result = await service.updateTenant('tenant-123', updateTenantDto);

      expect(result).toEqual({ ...mockTenant, ...updateTenantDto });
    });

    it('should throw ConflictException when updating to existing email', async () => {
      const updateTenantDto: UpdateTenantDto = {
        email: 'existing@testcompany.com',
      };

      const mockTenant = {
        id: 'tenant-123',
        email: 'current@testcompany.com',
      };

      const existingTenant = {
        id: 'other-tenant',
        email: 'existing@testcompany.com',
      };

      mockTenantRepository.findOne
        .mockResolvedValueOnce(mockTenant) // First call for getTenant
        .mockResolvedValueOnce(existingTenant); // Second call for email check

      await expect(service.updateTenant('tenant-123', updateTenantDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('updateTenantStatus', () => {
    it('should update tenant status successfully', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        status: 'active',
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockTenantRepository.save.mockResolvedValue({ ...mockTenant, status: 'suspended' });

      const result = await service.updateTenantStatus('tenant-123', { status: 'suspended' });

      expect(result.status).toBe('suspended');
    });
  });

  describe('updateTenantQuota', () => {
    it('should update tenant quota successfully', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
        quota_limit: 1000,
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockTenantRepository.save.mockResolvedValue({ ...mockTenant, quota_limit: 2000 });

      const result = await service.updateTenantQuota('tenant-123', { quota_limit: 2000 });

      expect(result.quota_limit).toBe(2000);
    });
  });

  describe('deleteTenant', () => {
    it('should delete tenant successfully', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Company',
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockTenantRepository.remove.mockResolvedValue(mockTenant);

      const result = await service.deleteTenant('tenant-123');

      expect(result).toEqual({ message: 'Tenant deleted successfully' });
    });
  });
});
