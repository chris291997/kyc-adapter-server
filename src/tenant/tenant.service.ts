import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { Verification } from '../database/entities/verification.entity';
import { ApiKey } from '../database/entities/api-key.entity';
import { User } from '../database/entities/user.entity';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getDashboardStats(tenantId: string) {
    const [
      totalVerifications,
      pendingVerifications,
      approvedVerifications,
      rejectedVerifications,
      quotaUsed,
      quotaLimit,
    ] = await Promise.all([
      this.verificationRepository.count({ where: { tenant_id: tenantId } }),
      this.verificationRepository.count({ where: { tenant_id: tenantId, status: 'pending' } }),
      this.verificationRepository.count({ where: { tenant_id: tenantId, status: 'approved' } }),
      this.verificationRepository.count({ where: { tenant_id: tenantId, status: 'rejected' } }),
      this.verificationRepository.count({ where: { tenant_id: tenantId } }),
      this.tenantRepository.findOne({ where: { id: tenantId }, select: ['quota_limit'] }),
    ]);

    return {
      verifications: {
        total: totalVerifications,
        pending: pendingVerifications,
        approved: approvedVerifications,
        rejected: rejectedVerifications,
        needsReview: await this.verificationRepository.count({ 
          where: { tenant_id: tenantId, status: 'needs_review' } 
        }),
      },
      quota: {
        used: quotaUsed,
        limit: quotaLimit?.quota_limit || 0,
        remaining: (quotaLimit?.quota_limit || 0) - quotaUsed,
      },
    };
  }

  async getVerifications(tenantId: string, page: number = 1, limit: number = 10, status?: string) {
    const where: any = { tenant_id: tenantId };
    if (status) where.status = status;

    const [verifications, total] = await this.verificationRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
      relations: ['provider'],
    });

    return {
      data: verifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getVerification(tenantId: string, verificationId: string) {
    return this.verificationRepository.findOne({
      where: { id: verificationId, tenant_id: tenantId },
      relations: ['provider', 'documents'],
    });
  }

  async getApiKeys(tenantId: string) {
    // Get all users for this tenant and their API keys
    const users = await this.userRepository.find({
      where: { tenant_id: tenantId },
      relations: ['api_keys'],
    });

    // Flatten and sanitize API keys (do not expose key_hash)
    const allApiKeys = users.flatMap(user => 
      user.api_keys.map(apiKey => ({
        id: apiKey.id,
        user_id: apiKey.user_id,
        key_prefix: apiKey.key_prefix,
        name: apiKey.name,
        scopes: apiKey.scopes,
        is_active: apiKey.is_active,
        last_used_at: apiKey.last_used_at,
        expires_at: apiKey.expires_at,
        created_at: apiKey.created_at,
        user_name: user.name,
        user_email: user.email,
      }))
    );

    return allApiKeys.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  async getUsers(tenantId: string, query: string = '', page: number = 1, limit: number = 10) {
    try {
      const searchTerm = `%${query}%`;
      const queryBuilder = this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.tenant', 'tenant')
        .where('user.tenant_id = :tenantId', { tenantId })
        .andWhere('user.tenant_id IS NOT NULL') // Exclude super admins
        .andWhere('user.user_type != :superAdmin', { superAdmin: 'super_admin' }); // Extra safety check

      // If query is provided (not wildcard %), add search conditions
      if (query && query !== '%') {
        queryBuilder.andWhere(
          '(user.name ILIKE :search OR user.email ILIKE :search)',
          { search: searchTerm }
        );
      }

      const [users, total] = await queryBuilder
        .orderBy('user.user_type', 'ASC') // Sort by user type: tenant_admin, tenant_user
        .addOrderBy('user.created_at', 'DESC') // Then by creation date
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        data: users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        query: query === '%' ? '' : query,
      };
    } catch (error) {
      this.logger.error('Error fetching tenant users:', error);
      throw error;
    }
  }
}

