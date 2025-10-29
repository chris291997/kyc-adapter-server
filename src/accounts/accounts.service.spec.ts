import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { Account } from '../database/entities/account.entity';
import { Verification } from '../database/entities/verification.entity';
import { VerificationDocument } from '../database/entities/verification-document.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

describe('AccountsService', () => {
  let service: AccountsService;
  let accountRepository: Repository<Account>;
  let verificationRepository: Repository<Verification>;
  let documentRepository: Repository<VerificationDocument>;

  const mockAccountRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockVerificationRepository = {
    findAndCount: jest.fn(),
    count: jest.fn(),
  };

  const mockDocumentRepository = {
    find: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: getRepositoryToken(Account),
          useValue: mockAccountRepository,
        },
        {
          provide: getRepositoryToken(Verification),
          useValue: mockVerificationRepository,
        },
        {
          provide: getRepositoryToken(VerificationDocument),
          useValue: mockDocumentRepository,
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    accountRepository = module.get<Repository<Account>>(getRepositoryToken(Account));
    verificationRepository = module.get<Repository<Verification>>(getRepositoryToken(Verification));
    documentRepository = module.get<Repository<VerificationDocument>>(getRepositoryToken(VerificationDocument));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated accounts for tenant', async () => {
      const tenantId = 'tenant-123';
      const mockAccounts = [
        { id: 'account-1', email: 'user1@example.com' },
        { id: 'account-2', email: 'user2@example.com' },
      ];

      mockAccountRepository.findAndCount.mockResolvedValue([mockAccounts, 2]);

      const result = await service.findAll(tenantId, 1, 10);

      expect(result).toEqual({
        data: mockAccounts,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should handle string page and limit parameters', async () => {
      const tenantId = 'tenant-123';
      const mockAccounts = [{ id: 'account-1', email: 'user1@example.com' }];

      mockAccountRepository.findAndCount.mockResolvedValue([mockAccounts, 1]);

      const result = await service.findAll(tenantId, 2, 5);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
    });
  });

  describe('findOne', () => {
    it('should return account for tenant', async () => {
      const tenantId = 'tenant-123';
      const accountId = 'account-123';
      const mockAccount = {
        id: accountId,
        tenant_id: tenantId,
        email: 'user@example.com',
        verification_status: 'verified',
      };

      mockAccountRepository.findOne.mockResolvedValue(mockAccount);

      const result = await service.findOne(tenantId, accountId);

      expect(result).toEqual(mockAccount);
      expect(mockAccountRepository.findOne).toHaveBeenCalledWith({
        where: { id: accountId, tenant_id: tenantId },
        relations: ['verifications', 'documents'],
      });
    });

    it('should throw NotFoundException when account not found', async () => {
      const tenantId = 'tenant-123';
      const accountId = 'non-existent';

      mockAccountRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(tenantId, accountId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update account successfully', async () => {
      const tenantId = 'tenant-123';
      const accountId = 'account-123';
      const updateDto: UpdateAccountDto = {
        email: 'updated@example.com',
      };

      const mockAccount = {
        id: accountId,
        tenant_id: tenantId,
        email: 'user@example.com',
        verification_status: 'pending',
      };

      mockAccountRepository.findOne.mockResolvedValue(mockAccount);
      mockAccountRepository.save.mockResolvedValue({ ...mockAccount, ...updateDto });

      const result = await service.update(tenantId, accountId, updateDto);

      expect(result).toEqual({ ...mockAccount, ...updateDto });
    });
  });

  describe('remove', () => {
    it('should remove account successfully', async () => {
      const tenantId = 'tenant-123';
      const accountId = 'account-123';
      const mockAccount = {
        id: accountId,
        tenant_id: tenantId,
        email: 'user@example.com',
        verification_status: 'unverified',
        getFullName: jest.fn().mockReturnValue('Test User'),
      };

      mockAccountRepository.findOne.mockResolvedValue(mockAccount);
      mockAccountRepository.remove.mockResolvedValue(mockAccount);

      const result = await service.remove(tenantId, accountId);

      expect(result).toEqual({ 
        id: 'account-123',
        message: 'Account deleted successfully' 
      });
    });
  });

  describe('getAccountVerifications', () => {
    it('should return verifications for account', async () => {
      const tenantId = 'tenant-123';
      const accountId = 'account-123';
      const mockAccount = {
        id: accountId,
        tenant_id: tenantId,
        email: 'user@example.com',
        verification_status: 'unverified',
        getFullName: jest.fn().mockReturnValue('Test User'),
      };

      const mockVerifications = [
        { id: 'verification-1', status: 'approved' },
        { id: 'verification-2', status: 'pending' },
      ];

      mockAccountRepository.findOne.mockResolvedValue(mockAccount);
      mockVerificationRepository.findAndCount.mockResolvedValue([mockVerifications, 2]);

      const result = await service.getAccountVerifications(tenantId, accountId, 1, 10);

      expect(result).toEqual({
        data: mockVerifications,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        account: {
          id: accountId,
          name: 'Test User',
          email: 'user@example.com',
          verification_status: 'unverified',
        },
      });
    });

    it('should throw NotFoundException when account not found', async () => {
      const tenantId = 'tenant-123';
      const accountId = 'non-existent';

      mockAccountRepository.findOne.mockResolvedValue(null);

      await expect(service.getAccountVerifications(tenantId, accountId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAccountDocuments', () => {
    it('should return documents for account', async () => {
      const tenantId = 'tenant-123';
      const accountId = 'account-123';
      const mockAccount = {
        id: accountId,
        tenant_id: tenantId,
        email: 'user@example.com',
        verification_status: 'unverified',
        getFullName: jest.fn().mockReturnValue('Test User'),
      };

      const mockDocuments = [
        { id: 'doc-1', document_type: 'passport' },
        { id: 'doc-2', document_type: 'driver_license' },
      ];

      mockAccountRepository.findOne.mockResolvedValue(mockAccount);
      mockDocumentRepository.find.mockResolvedValue(mockDocuments);

      const result = await service.getAccountDocuments(tenantId, accountId);

      expect(result).toEqual({
        documents: mockDocuments,
        total: 2,
        account: {
          id: accountId,
          name: 'Test User',
          email: 'user@example.com',
        },
      });
    });
  });

  describe('searchAccounts', () => {
    it('should search accounts by email or reference_id', async () => {
      const tenantId = 'tenant-123';
      const query = 'test@example.com';
      const mockAccounts = [
        { id: 'account-1', email: 'test@example.com' },
      ];

      mockAccountRepository.findAndCount.mockResolvedValue([mockAccounts, 1]);

      const result = await service.searchAccounts(tenantId, query, 1, 10);

      expect(result).toEqual({
        data: mockAccounts,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        query,
      });
    });
  });

  describe('getAccountStats', () => {
    it('should return account statistics', async () => {
      const tenantId = 'tenant-123';
      const accountId = 'account-123';
      const mockAccount = {
        id: accountId,
        tenant_id: tenantId,
        email: 'user@example.com',
        verification_status: 'verified',
        phone: '+1234567890',
        reference_id: 'ref-123',
        getFullName: jest.fn().mockReturnValue('Test User'),
      };

      mockAccountRepository.findOne.mockResolvedValue(mockAccount);
      mockVerificationRepository.count
        .mockResolvedValueOnce(5)  // total
        .mockResolvedValueOnce(5)  // approved
        .mockResolvedValueOnce(5)  // pending
        .mockResolvedValueOnce(5); // rejected
      mockDocumentRepository.count.mockResolvedValue(3);

      const result = await service.getAccountStats(tenantId, accountId);

      expect(result).toEqual({
        account: {
          id: accountId,
          name: 'Test User',
          email: 'user@example.com',
          phone: '+1234567890',
          reference_id: 'ref-123',
          verification_status: 'verified',
          created_at: undefined,
        },
        statistics: {
          verifications: {
            total: 5,
            approved: 5,
            pending: 5,
            rejected: 5,
          },
          documents: {
            total: 3,
          },
        },
      });
    });
  });
});
