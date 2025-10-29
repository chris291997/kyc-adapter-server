import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    changes?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ) {
    const auditLog = this.auditLogRepository.create({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      changes,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date(),
    });

    await this.auditLogRepository.save(auditLog);
  }

  async getAuditLogs(
    userId?: string,
    resourceType?: string,
    resourceId?: string,
    page: number = 1,
    limit: number = 50
  ) {
    const where: any = {};
    if (userId) where.user_id = userId;
    if (resourceType) where.resource_type = resourceType;
    if (resourceId) where.resource_id = resourceId;

    const [logs, total] = await this.auditLogRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

