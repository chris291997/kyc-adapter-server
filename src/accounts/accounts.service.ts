import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Account } from '../database/entities/account.entity';
import { Verification } from '../database/entities/verification.entity';
import { VerificationDocument } from '../database/entities/verification-document.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    @InjectRepository(VerificationDocument)
    private readonly documentRepository: Repository<VerificationDocument>,
  ) {}

  async create(tenantId: string, createAccountDto: CreateAccountDto) {
    // Check for duplicate by email
    if (createAccountDto.email) {
      const existingByEmail = await this.accountRepository.findOne({
        where: { tenant_id: tenantId, email: createAccountDto.email },
      });

      if (existingByEmail) {
        throw new ConflictException(`Account with email ${createAccountDto.email} already exists`);
      }
    }

    // Check for duplicate by reference_id
    if (createAccountDto.reference_id) {
      const existingByRef = await this.accountRepository.findOne({
        where: { tenant_id: tenantId, reference_id: createAccountDto.reference_id },
      });

      if (existingByRef) {
        throw new ConflictException(`Account with reference ID ${createAccountDto.reference_id} already exists`);
      }
    }

    const account = this.accountRepository.create({
      tenant_id: tenantId,
      reference_id: createAccountDto.reference_id,
      name: createAccountDto.name,
      email: createAccountDto.email,
      phone: createAccountDto.phone,
      birthdate: createAccountDto.birthdate ? new Date(createAccountDto.birthdate) : null,
      address: createAccountDto.address,
      metadata: createAccountDto.metadata,
      verification_status: 'unverified',
    });

    return this.accountRepository.save(account);
  }

  async findAll(tenantId: string | null, page: number = 1, limit: number = 10) {
    // Ensure page and limit are numbers
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;

    // Build where clause - if tenantId is null (super admin), get all accounts
    const where: any = {};
    if (tenantId) {
      where.tenant_id = tenantId;
    }

    const [accounts, total] = await this.accountRepository.findAndCount({
      where: where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      order: { created_at: 'DESC' },
      relations: ['tenant'], // Include tenant info
    });

    return {
      data: accounts,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async findOne(tenantId: string, id: string) {
    const account = await this.accountRepository.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['verifications', 'documents'],
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async update(tenantId: string, id: string, updateAccountDto: UpdateAccountDto) {
    const account = await this.accountRepository.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    // Update fields
    if (updateAccountDto.reference_id !== undefined) account.reference_id = updateAccountDto.reference_id;
    if (updateAccountDto.name !== undefined) account.name = updateAccountDto.name;
    if (updateAccountDto.email !== undefined) account.email = updateAccountDto.email;
    if (updateAccountDto.phone !== undefined) account.phone = updateAccountDto.phone;
    if (updateAccountDto.birthdate !== undefined) account.birthdate = new Date(updateAccountDto.birthdate);
    if (updateAccountDto.address !== undefined) account.address = updateAccountDto.address;
    if (updateAccountDto.metadata !== undefined) {
      account.metadata = { ...account.metadata, ...updateAccountDto.metadata };
    }

    return this.accountRepository.save(account);
  }

  async remove(tenantId: string, id: string) {
    const account = await this.accountRepository.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    await this.accountRepository.remove(account);

    return { message: 'Account deleted successfully', id };
  }

  // Helper method to update verification status after KYC
  async updateVerificationStatus(
    accountId: string,
    status: 'unverified' | 'pending' | 'verified' | 'rejected',
    verificationId: string,
    verifiedData?: Record<string, any>
  ) {
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    account.verification_status = status;
    account.last_verification_id = verificationId;

    if (verifiedData) {
      account.verified_data = verifiedData;
    }

    return this.accountRepository.save(account);
  }

  // Get all verifications for a specific account
  async getAccountVerifications(tenantId: string, accountId: string, page: number = 1, limit: number = 10) {
    // Verify account belongs to tenant
    const account = await this.accountRepository.findOne({
      where: { id: accountId, tenant_id: tenantId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    // Ensure page and limit are numbers
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;

    const [verifications, total] = await this.verificationRepository.findAndCount({
      where: { account_id: accountId },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      order: { created_at: 'DESC' },
      relations: ['provider', 'documents'],
    });

    return {
      data: verifications,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      account: {
        id: account.id,
        name: account.getFullName(),
        email: account.email,
        verification_status: account.verification_status,
      },
    };
  }

  // Get all documents for a specific account
  async getAccountDocuments(tenantId: string, accountId: string) {
    // Verify account belongs to tenant
    const account = await this.accountRepository.findOne({
      where: { id: accountId, tenant_id: tenantId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    const documents = await this.documentRepository.find({
      where: { account_id: accountId },
      order: { uploaded_at: 'DESC' },
      relations: ['verification'],
    });

    return {
      account: {
        id: account.id,
        name: account.getFullName(),
        email: account.email,
      },
      documents,
      total: documents.length,
    };
  }

  // Search accounts by email, name, or reference_id
  async searchAccounts(tenantId: string, query: string, page: number = 1, limit: number = 10) {
    // Ensure page and limit are numbers
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;

    const [accounts, total] = await this.accountRepository.findAndCount({
      where: [
        { tenant_id: tenantId, email: Like(`%${query}%`) },
        { tenant_id: tenantId, reference_id: Like(`%${query}%`) },
      ],
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      order: { created_at: 'DESC' },
    });

    return {
      data: accounts,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      query,
    };
  }

  // Get account statistics
  async getAccountStats(tenantId: string, accountId: string) {
    // Verify account belongs to tenant
    const account = await this.accountRepository.findOne({
      where: { id: accountId, tenant_id: tenantId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    const [
      totalVerifications,
      pendingVerifications,
      verifiedVerifications,
      rejectedVerifications,
      totalDocuments,
    ] = await Promise.all([
      this.verificationRepository.count({ where: { account_id: accountId } }),
      this.verificationRepository.count({ where: { account_id: accountId, status: 'pending' } }),
      // Count both 'verified' and 'approved' for backward compatibility during migration
      this.verificationRepository.count({ 
        where: { account_id: accountId, status: In(['verified', 'approved']) }
      }),
      this.verificationRepository.count({ where: { account_id: accountId, status: 'rejected' } }),
      this.documentRepository.count({ where: { account_id: accountId } }),
    ]);

    return {
      account: {
        id: account.id,
        name: account.getFullName(),
        email: account.email,
        phone: account.phone,
        reference_id: account.reference_id,
        verification_status: account.verification_status,
        created_at: account.created_at,
      },
      statistics: {
        verifications: {
          total: totalVerifications,
          pending: pendingVerifications,
          verified: verifiedVerifications,
          rejected: rejectedVerifications,
        },
        documents: {
          total: totalDocuments,
        },
      },
    };
  }

  // Find or create account (useful for verification flow)
  async findOrCreate(tenantId: string, createAccountDto: CreateAccountDto) {
    // Try to find by email first
    if (createAccountDto.email) {
      const existing = await this.accountRepository.findOne({
        where: { tenant_id: tenantId, email: createAccountDto.email },
      });

      if (existing) {
        return { account: existing, created: false };
      }
    }

    // Try to find by reference_id
    if (createAccountDto.reference_id) {
      const existing = await this.accountRepository.findOne({
        where: { tenant_id: tenantId, reference_id: createAccountDto.reference_id },
      });

      if (existing) {
        return { account: existing, created: false };
      }
    }

    // Create new account
    const account = await this.create(tenantId, createAccountDto);
    return { account, created: true };
  }
}

