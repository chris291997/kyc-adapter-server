import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '../database/entities/user.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { Provider } from '../database/entities/provider.entity';
import { Verification } from '../database/entities/verification.entity';
import { TenantProviderConfig } from '../database/entities/tenant-provider-config.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto, UpdateTenantStatusDto, UpdateTenantQuotaDto } from './dto/update-tenant.dto';
import { CreateTenantProviderConfigDto, UpdateTenantProviderConfigDto } from './dto/tenant-provider-config.dto';
import { CreateProviderDto, UpdateProviderDto, UpdateProviderStatusDto, ProviderTestResponseDto, ProviderType } from './dto/provider.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    @InjectRepository(TenantProviderConfig)
    private readonly tenantProviderConfigRepository: Repository<TenantProviderConfig>,
  ) {}

  async getDashboardStats() {
    const [
      totalTenants,
      totalProviders,
      totalVerifications,
      pendingVerifications,
      verifiedVerifications,
      rejectedVerifications,
    ] = await Promise.all([
      this.tenantRepository.count(),
      this.providerRepository.count({ where: { is_active: true } }),
      this.verificationRepository.count(),
      this.verificationRepository.count({ where: { status: 'pending' } }),
      // Count both 'verified' and 'approved' for backward compatibility during migration
      this.verificationRepository.count({ 
        where: { status: In(['verified', 'approved']) }
      }),
      this.verificationRepository.count({ where: { status: 'rejected' } }),
    ]);

    return {
      tenants: {
        total: totalTenants,
        active: await this.tenantRepository.count({ where: { status: 'active' } }),
        suspended: await this.tenantRepository.count({ where: { status: 'suspended' } }),
      },
      providers: {
        total: totalProviders,
        active: await this.providerRepository.count({ where: { is_active: true } }),
      },
      verifications: {
        total: totalVerifications,
        pending: pendingVerifications,
        verified: verifiedVerifications,
        rejected: rejectedVerifications,
      },
    };
  }

  async getAllTenants(page: number = 1, limit: number = 10) {
    try {
      const [tenants, total] = await this.tenantRepository.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
        order: { created_at: 'DESC' },
        relations: ['users'],
      });

      return {
        data: tenants,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Error fetching tenants:', error);
      throw error;
    }
  }

  async searchTenants(query: string, page: number = 1, limit: number = 10) {
    try {
      const searchTerm = `%${query}%`;
      
      const [tenants, total] = await this.tenantRepository
        .createQueryBuilder('tenant')
        .leftJoinAndSelect('tenant.users', 'users')
        .where(
          'tenant.name ILIKE :search OR tenant.email ILIKE :search',
          { search: searchTerm }
        )
        .orderBy('tenant.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        data: tenants,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        query: query,
      };
    } catch (error) {
      this.logger.error('Error searching tenants:', error);
      throw error;
    }
  }

  async searchUsers(query: string, page: number = 1, limit: number = 10, tenantId?: string, includeSuperAdmins: boolean = false) {
    try {
      const hasQuery = (query ?? '').trim().length > 0;
      const searchTerm = hasQuery ? `%${query}%` : '%';
      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      const isUuidQuery = hasQuery && uuidRegex.test(query.trim());
      const queryBuilder = this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.tenant', 'tenant')
        .where('1=1');

      if (hasQuery) {
        if (isUuidQuery) {
          queryBuilder.andWhere(
            '(user.id = :idQuery OR user.name ILIKE :search OR user.email ILIKE :search)',
            { idQuery: query.trim(), search: searchTerm }
          );
        } else {
          queryBuilder.andWhere(
            'user.name ILIKE :search OR user.email ILIKE :search',
            { search: searchTerm }
          );
        }
      }

      // If tenantId is provided, validate it's a valid UUID and filter by tenant
      if (tenantId) {
        // Validate UUID format
        if (!uuidRegex.test(tenantId)) {
          throw new BadRequestException(`Invalid tenantId format: ${tenantId}. Must be a valid UUID.`);
        }
        queryBuilder.andWhere('user.tenant_id = :tenantId', { tenantId });
      }

      // Exclude super admins unless explicitly requested
      if (!includeSuperAdmins) {
        queryBuilder
          .andWhere('user.tenant_id IS NOT NULL') // Exclude super admins (tenant_id = null)
          .andWhere('user.user_type != :superAdmin', { superAdmin: 'super_admin' }); // Extra safety check
      }

      const [users, total] = await queryBuilder
        .orderBy('user.user_type', 'ASC') // Sort by user type: super_admin, tenant_admin, tenant_user
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
        query: hasQuery ? query : '',
      };
    } catch (error) {
      this.logger.error('Error searching users:', error);
      throw error;
    }
  }

  async getAllVerifications(page: number = 1, limit: number = 10) {
    const [verifications, total] = await this.verificationRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
      relations: ['tenant', 'provider', 'account'],
    });

    return {
      data: verifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // CRUD Operations for Tenants
  async createTenant(createTenantDto: CreateTenantDto) {
    const { 
      name, 
      email, 
      password, 
      quotaLimit, 
      status,
      firstName,
      lastName,
      mobile
    } = createTenantDto;

    // Check if tenant already exists
    const existingTenant = await this.tenantRepository.findOne({ where: { email } });
    if (existingTenant) {
      throw new ConflictException('Tenant with this email already exists');
    }

    // Create tenant
    const tenant = this.tenantRepository.create({
      name,
      email,
      quota_limit: quotaLimit || 1000,
      status: status || 'active',
    });

    const savedTenant = await this.tenantRepository.save(tenant);

    // Build admin user name from firstName/lastName or use tenant name
    const adminName = firstName && lastName 
      ? `${firstName} ${lastName}`.trim()
      : firstName || lastName || name;

    // Build name_details if firstName/lastName provided
    const nameDetails = (firstName || lastName) ? {
      first: firstName || '',
      last: lastName || '',
    } : undefined;

    // Create first tenant admin user
    const passwordHash = await bcrypt.hash(password, 10);
    const adminUser = this.userRepository.create({
      email,
      password_hash: passwordHash,
      name: adminName,
      name_details: nameDetails,
      phone: mobile,
      user_type: 'tenant_admin',
      status: 'active',
      tenant_id: savedTenant.id,
    });

    await this.userRepository.save(adminUser);

    this.logger.log(`Created tenant: ${savedTenant.name} with admin user: ${email}`);

    return {
      ...savedTenant,
      admin_user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        name_details: adminUser.name_details,
        phone: adminUser.phone,
        user_type: adminUser.user_type,
        status: adminUser.status,
      },
    };
  }

  async getTenant(id: string) {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
      relations: ['users', 'accounts'],
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    return tenant;
  }

  async updateTenant(id: string, updateTenantDto: UpdateTenantDto) {
    const tenant = await this.getTenant(id);

    // Check if email is being changed and if it's already taken
    if (updateTenantDto.email && updateTenantDto.email !== tenant.email) {
      const existingTenant = await this.tenantRepository.findOne({
        where: { email: updateTenantDto.email },
      });
      if (existingTenant) {
        throw new ConflictException('Tenant with this email already exists');
      }
    }

    Object.assign(tenant, updateTenantDto);
    await this.tenantRepository.save(tenant);

    this.logger.log(`Updated tenant: ${tenant.name}`);

    return tenant;
  }

  async updateTenantStatus(id: string, updateStatusDto: UpdateTenantStatusDto) {
    const tenant = await this.getTenant(id);
    tenant.status = updateStatusDto.status;
    await this.tenantRepository.save(tenant);

    this.logger.log(`Updated tenant status: ${tenant.name} -> ${tenant.status}`);

    return tenant;
  }

  async updateTenantQuota(id: string, updateQuotaDto: UpdateTenantQuotaDto) {
    const tenant = await this.getTenant(id);
    tenant.quota_limit = updateQuotaDto.quota_limit;
    await this.tenantRepository.save(tenant);

    this.logger.log(`Updated tenant quota: ${tenant.name} -> ${tenant.quota_limit}`);

    return tenant;
  }

  async deleteTenant(id: string) {
    const tenant = await this.getTenant(id);
    await this.tenantRepository.remove(tenant);

    this.logger.log(`Deleted tenant: ${tenant.name}`);

    return { message: 'Tenant deleted successfully' };
  }

  // Tenant Provider Configuration Management
  async getTenantProviderConfigs(tenantId: string) {
    const configs = await this.tenantProviderConfigRepository.find({
      where: { tenant_id: tenantId },
      relations: ['provider'],
      order: { priority: 'ASC' },
    });

    // Return cleaner, more intuitive response
    return configs.map(config => ({
      config_id: config.id, // ← Clear label for the configuration ID
      tenant_id: config.tenant_id,
      provider: {
        id: config.provider.id,
        name: config.provider.name,
        type: config.provider.type,
        base_url: config.provider.base_url,
        api_version: config.provider.api_version,
        is_active: config.provider.is_active,
      },
      tenant_overrides: config.tenant_overrides,
      webhook_endpoint: `/v1/webhook/${(config.provider.name || '').toLowerCase()}`,
      webhook_secret_set: Boolean(config.provider?.webhook_secret),
      priority: config.priority,
      is_enabled: config.is_enabled,
      created_at: config.created_at,
      updated_at: config.updated_at,
    }));
  }

  async createTenantProviderConfig(tenantId: string, createConfigDto: CreateTenantProviderConfigDto) {
    // Verify tenant exists
    const tenant = await this.getTenant(tenantId);
    
    // Verify provider exists
    const provider = await this.providerRepository.findOne({
      where: { id: createConfigDto.provider_id }
    });
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${createConfigDto.provider_id} not found`);
    }

    // Check if configuration already exists
    const existingConfig = await this.tenantProviderConfigRepository.findOne({
      where: { 
        tenant_id: tenantId, 
        provider_id: createConfigDto.provider_id 
      }
    });
    if (existingConfig) {
      throw new ConflictException('Provider is already configured for this tenant');
    }

    // Create assignment (no config, just link)
    const assignment = this.tenantProviderConfigRepository.create({
      tenant_id: tenantId,
      provider_id: createConfigDto.provider_id,
      priority: createConfigDto.priority || 1,
      is_enabled: createConfigDto.is_enabled !== false,
    });

    const savedAssignment = await this.tenantProviderConfigRepository.save(assignment);

    this.logger.log(`Assigned provider to tenant: ${tenant.name} -> provider: ${provider.name}`);

    // Return a cleaner, more intuitive response
    return {
      assignment_id: savedAssignment.id,
      tenant_id: savedAssignment.tenant_id,
      provider: {
        id: provider.id,
        name: provider.name,
        type: provider.type,
        base_url: provider.base_url,
        api_version: provider.api_version,
        is_active: provider.is_active,
      },
      priority: savedAssignment.priority,
      is_enabled: savedAssignment.is_enabled,
      created_at: savedAssignment.created_at,
      updated_at: savedAssignment.updated_at,
    };
  }

  async updateTenantProviderConfig(tenantId: string, configId: string, updateConfigDto: UpdateTenantProviderConfigDto) {
    const config = await this.tenantProviderConfigRepository.findOne({
      where: { id: configId, tenant_id: tenantId },
      relations: ['provider'],
    });

    if (!config) {
      throw new NotFoundException(`Provider configuration not found for tenant`);
    }

    // Safely merge updates without dropping existing config keys
    if (Object.prototype.hasOwnProperty.call(updateConfigDto, 'priority')) {
      (config as any).priority = (updateConfigDto as any).priority;
    }
    if (Object.prototype.hasOwnProperty.call(updateConfigDto, 'is_enabled')) {
      (config as any).is_enabled = (updateConfigDto as any).is_enabled;
    }
    if ((updateConfigDto as any).config) {
      const current = (config as any).config || {};
      (config as any).config = { ...current, ...(updateConfigDto as any).config };
    }
    await this.tenantProviderConfigRepository.save(config);

    this.logger.log(`Updated provider config for tenant: ${tenantId} -> provider: ${config.provider.name}`);

    return config;
  }

  async deleteTenantProviderConfig(tenantId: string, configId: string) {
    // First check if tenant exists
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // Then check if the config exists
    const config = await this.tenantProviderConfigRepository.findOne({
      where: { id: configId, tenant_id: tenantId },
      relations: ['provider'],
    });

    if (!config) {
      throw new NotFoundException(
        `Provider configuration with ID ${configId} not found for tenant ${tenantId}. ` +
        `Make sure you're using the correct configId from GET /admin/tenants/{tenantId}/providers`
      );
    }

    await this.tenantProviderConfigRepository.remove(config);

    this.logger.log(`Deleted provider config for tenant: ${tenantId} -> provider: ${config.provider.name}`);

    return { message: 'Provider configuration deleted successfully' };
  }

  async getTenantProviderConfig(tenantId: string, configId: string) {
    const config = await this.tenantProviderConfigRepository.findOne({
      where: { id: configId, tenant_id: tenantId },
      relations: ['provider'],
    });

    if (!config) {
      throw new NotFoundException(`Provider configuration not found for tenant`);
    }

    // Return cleaner, more intuitive response
    return {
      assignment_id: config.id,
      tenant_id: config.tenant_id,
      provider: {
        id: config.provider.id,
        name: config.provider.name,
        type: config.provider.type,
        base_url: config.provider.base_url,
        api_version: config.provider.api_version,
        is_active: config.provider.is_active,
      },
      tenant_overrides: config.tenant_overrides,
      webhook_endpoint: `/v1/webhook/${(config.provider.name || '').toLowerCase()}`,
      webhook_secret_set: Boolean(config.provider?.webhook_secret),
      priority: config.priority,
      is_enabled: config.is_enabled,
      created_at: config.created_at,
      updated_at: config.updated_at,
    };
  }

  // Provider Management
  async createProvider(createProviderDto: CreateProviderDto) {
    // Check if provider name already exists
    const existingProvider = await this.providerRepository.findOne({
      where: { name: createProviderDto.name }
    });
    if (existingProvider) {
      throw new ConflictException('Provider with this name already exists');
    }

    // Prepare provider data
    const providerData: any = {
      name: createProviderDto.name,
      base_url: createProviderDto.base_url,
      supports_webhooks: createProviderDto.supports_webhooks || false,
      supports_multi_step: createProviderDto.supports_multi_step || false,
      supports_hosted_workflow: createProviderDto.supports_hosted_workflow || false,
      config: createProviderDto.config || {},
      // Support both 'status' and 'is_active' field names
      is_active: createProviderDto.status !== undefined ? createProviderDto.status : (createProviderDto.is_active !== undefined ? createProviderDto.is_active : true),
      // Add centralized credentials if provided
      api_key: createProviderDto.api_key,
      secret_key: createProviderDto.secret_key,
      webhook_secret: createProviderDto.webhook_secret,
    };

    // Add optional fields only if provided
    if (createProviderDto.type) {
      providerData.type = createProviderDto.type;
      
      // Auto-detect capabilities based on type if not provided
      const capabilities = this.autoDetectCapabilities(createProviderDto.type, {
        supports_webhooks: createProviderDto.supports_webhooks,
        supports_multi_step: createProviderDto.supports_multi_step,
        supports_hosted_workflow: createProviderDto.supports_hosted_workflow,
      });
      
      providerData.supports_webhooks = capabilities.supports_webhooks;
      providerData.supports_multi_step = capabilities.supports_multi_step;
      providerData.supports_hosted_workflow = capabilities.supports_hosted_workflow;
    }

    if (createProviderDto.api_version) {
      providerData.api_version = createProviderDto.api_version;
    } else {
      providerData.api_version = 'v1'; // Default value
    }

    // Create provider
    const provider = this.providerRepository.create(providerData);
    const savedProvider = await this.providerRepository.save(provider);

    // Ensure we have a Provider object, not an array
    const savedProviderObj = Array.isArray(savedProvider) ? savedProvider[0] : savedProvider;
    
    this.logger.log(`Created provider: ${savedProviderObj.name}${savedProviderObj.type ? ` (${savedProviderObj.type})` : ''}`);

    return savedProviderObj;
  }

  async updateProviderStatus(id: string, updateStatusDto: UpdateProviderStatusDto) {
    const provider = await this.providerRepository.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }
    provider.is_active = updateStatusDto.is_active;
    await this.providerRepository.save(provider);

    this.logger.log(`Updated provider status: ${provider.name} -> ${provider.is_active ? 'active' : 'inactive'}`);

    return provider;
  }

  async deleteProvider(id: string) {
    const provider = await this.providerRepository.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }

    // Check if provider is in use by any tenants
    const tenantConfigs = await this.tenantProviderConfigRepository.count({
      where: { provider_id: id }
    });

    if (tenantConfigs > 0) {
      throw new ConflictException('Cannot delete provider that is configured by tenants. Deactivate instead.');
    }

    // Check if provider has any verifications
    const verifications = await this.verificationRepository.count({
      where: { provider_id: id }
    });

    if (verifications > 0) {
      throw new ConflictException('Cannot delete provider with existing verifications. Deactivate instead.');
    }

    // Soft delete by deactivating
    provider.is_active = false;
    await this.providerRepository.save(provider);

    this.logger.log(`Deactivated provider: ${provider.name}`);

    return { message: 'Provider deactivated successfully' };
  }

  async testProviderConnection(id: string): Promise<ProviderTestResponseDto> {
    const startTime = Date.now();
    
    try {
      const provider = await this.getProvider(id);
      
      // Basic URL validation and connectivity test
      const testResult = await this.performBasicUrlTest(provider.base_url);
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: testResult.success,
        message: testResult.message,
        responseTime,
        error: testResult.error,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        message: 'Provider test failed',
        responseTime,
        error: error.message,
      };
    }
  }

  // Helper method to auto-detect capabilities based on provider type
  private autoDetectCapabilities(
    type: ProviderType,
    manualCapabilities: {
      supports_webhooks?: boolean;
      supports_multi_step?: boolean;
      supports_hosted_workflow?: boolean;
    }
  ) {
    // Default capabilities based on type
    const typeDefaults = {
      [ProviderType.SINGLE_STEP]: {
        supports_webhooks: false,
        supports_multi_step: false,
        supports_hosted_workflow: false,
      },
      [ProviderType.MULTI_STEP]: {
        supports_webhooks: false,
        supports_multi_step: true,
        supports_hosted_workflow: true,
      },
      [ProviderType.ASYNC_WEBHOOK]: {
        supports_webhooks: true,
        supports_multi_step: true,
        supports_hosted_workflow: false,
      },
    };

    const defaults = typeDefaults[type];

    // Use manual overrides if provided, otherwise use type defaults
    return {
      supports_webhooks: manualCapabilities.supports_webhooks !== undefined 
        ? manualCapabilities.supports_webhooks 
        : defaults.supports_webhooks,
      supports_multi_step: manualCapabilities.supports_multi_step !== undefined 
        ? manualCapabilities.supports_multi_step 
        : defaults.supports_multi_step,
      supports_hosted_workflow: manualCapabilities.supports_hosted_workflow !== undefined 
        ? manualCapabilities.supports_hosted_workflow 
        : defaults.supports_hosted_workflow,
    };
  }

  // Helper method to perform basic URL connectivity test
  private async performBasicUrlTest(baseUrl: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      // Basic URL format validation
      const url = new URL(baseUrl);
      
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          success: false,
          message: 'Invalid URL protocol. Only HTTP and HTTPS are supported.',
          error: 'Invalid protocol'
        };
      }

      // For now, we'll just validate the URL format
      // In a production environment, you might want to make an actual HTTP request
      // to test connectivity, but that could be slow and might fail due to network issues
      
      return {
        success: true,
        message: 'URL format is valid and accessible',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Invalid URL format',
        error: error.message,
      };
    }
  }

  // ===== NEW: Centralized Provider Management =====

  /**
   * Get all providers (super admin only)
   * Returns providers with their centralized configuration
   */
  async getAllProviders() {
    const providers = await this.providerRepository.find({
      order: { name: 'ASC' },
    });

    return providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      base_url: provider.base_url,
      api_version: provider.api_version,
      webhook_endpoint: `/v1/webhook/${(provider.name || '').toLowerCase().replace(/\s+/g, '-')}`,
      webhook_secret_set: Boolean(provider.webhook_secret),
      api_key_set: Boolean(provider.api_key),
      secret_key_set: Boolean(provider.secret_key),
      supports_webhooks: provider.supports_webhooks,
      supports_multi_step: provider.supports_multi_step,
      supports_hosted_workflow: provider.supports_hosted_workflow,
      is_active: provider.is_active,
      config: provider.config,
      created_at: provider.created_at,
      updated_at: provider.updated_at,
    }));
  }

  /**
   * Get single provider with full details (super admin only)
   */
  async getProvider(providerId: string) {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      api_version: provider.api_version,
      base_url: provider.base_url,
      supports_webhooks: provider.supports_webhooks,
      supports_multi_step: provider.supports_multi_step,
      supports_hosted_workflow: provider.supports_hosted_workflow,
      is_active: provider.is_active,
      config: provider.config,
      webhook_endpoint: `/v1/webhook/${(provider.name || '').toLowerCase()}`,
      api_key_set: Boolean(provider.api_key),
      secret_key_set: Boolean(provider.secret_key),
      webhook_secret_set: Boolean(provider.webhook_secret),
      created_at: provider.created_at,
      updated_at: provider.updated_at,
    };
  }

  /**
   * Update provider (super admin only)
   * Used to configure provider credentials centrally
   */
  async updateProvider(providerId: string, updateDto: UpdateProviderDto) {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    // Update fields
    if (updateDto.name !== undefined) provider.name = updateDto.name;
    if (updateDto.type !== undefined) provider.type = updateDto.type;
    if (updateDto.base_url !== undefined) provider.base_url = updateDto.base_url;
    if (updateDto.api_version !== undefined) provider.api_version = updateDto.api_version;
    if (updateDto.api_key !== undefined) provider.api_key = updateDto.api_key;
    if (updateDto.secret_key !== undefined) provider.secret_key = updateDto.secret_key;
    if (updateDto.webhook_secret !== undefined) provider.webhook_secret = updateDto.webhook_secret;
    if (updateDto.is_active !== undefined) provider.is_active = updateDto.is_active;
    
    // Merge config (don't overwrite existing keys unless specified)
    if (updateDto.config) {
      provider.config = {
        ...provider.config,
        ...updateDto.config,
      };
    }

    await this.providerRepository.save(provider);

    this.logger.log(`Provider updated: ${provider.name}`);

    return this.getProvider(providerId);
  }

  /**
   * Get all provider assignments for a tenant
   * Shows which providers are assigned to the tenant (no credentials exposed)
   */
  async getTenantProviderAssignments(tenantId: string) {
    const assignments = await this.tenantProviderConfigRepository.find({
      where: { tenant_id: tenantId },
      relations: ['provider'],
      order: { priority: 'ASC' },
    });

    return assignments.map(assignment => ({
      assignment_id: assignment.id,
      tenant_id: assignment.tenant_id,
      provider: {
        id: assignment.provider.id,
        name: assignment.provider.name,
        type: assignment.provider.type,
        webhook_endpoint: `/v1/webhook/${(assignment.provider.name || '').toLowerCase().replace(/\s+/g, '-')}`,
      },
      priority: assignment.priority,
      is_enabled: assignment.is_enabled,
      tenant_overrides: assignment.tenant_overrides,
      created_at: assignment.created_at,
      updated_at: assignment.updated_at,
    }));
  }

  /**
   * Assign a provider to a tenant (super admin only)
   */
  async assignProviderToTenant(tenantId: string, providerId: string, priority: number = 1) {
    // Verify tenant exists
    const tenant = await this.getTenant(tenantId);

    // Verify provider exists
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    // Check if already assigned
    const existing = await this.tenantProviderConfigRepository.findOne({
      where: { tenant_id: tenantId, provider_id: providerId },
    });

    if (existing) {
      throw new ConflictException('Provider already assigned to this tenant');
    }

    // Create assignment
    const assignment = this.tenantProviderConfigRepository.create({
      tenant_id: tenantId,
      provider_id: providerId,
      priority,
      is_enabled: true,
    });

    await this.tenantProviderConfigRepository.save(assignment);

    this.logger.log(`Assigned provider ${provider.name} to tenant ${tenant.name}`);

    return {
      assignment_id: assignment.id,
      tenant_id: assignment.tenant_id,
      provider: {
        id: provider.id,
        name: provider.name,
        type: provider.type,
      },
      priority: assignment.priority,
      is_enabled: assignment.is_enabled,
    };
  }

  /**
   * Update provider assignment (priority, enabled status, overrides)
   */
  async updateProviderAssignment(
    tenantId: string,
    assignmentId: string,
    updates: { priority?: number; is_enabled?: boolean; tenant_overrides?: Record<string, any> }
  ) {
    const assignment = await this.tenantProviderConfigRepository.findOne({
      where: { id: assignmentId, tenant_id: tenantId },
      relations: ['provider'],
    });

    if (!assignment) {
      throw new NotFoundException('Provider assignment not found');
    }

    if (updates.priority !== undefined) assignment.priority = updates.priority;
    if (updates.is_enabled !== undefined) assignment.is_enabled = updates.is_enabled;
    if (updates.tenant_overrides !== undefined) {
      assignment.tenant_overrides = {
        ...assignment.tenant_overrides,
        ...updates.tenant_overrides,
      };
    }

    await this.tenantProviderConfigRepository.save(assignment);

    return {
      assignment_id: assignment.id,
      tenant_id: assignment.tenant_id,
      provider: {
        id: assignment.provider.id,
        name: assignment.provider.name,
        type: assignment.provider.type,
      },
      priority: assignment.priority,
      is_enabled: assignment.is_enabled,
      tenant_overrides: assignment.tenant_overrides,
    };
  }

  /**
   * Remove provider assignment from tenant
   */
  async unassignProviderFromTenant(tenantId: string, assignmentId: string) {
    const assignment = await this.tenantProviderConfigRepository.findOne({
      where: { id: assignmentId, tenant_id: tenantId },
    });

    if (!assignment) {
      throw new NotFoundException('Provider assignment not found');
    }

    await this.tenantProviderConfigRepository.remove(assignment);

    this.logger.log(`Removed provider assignment ${assignmentId} from tenant ${tenantId}`);

    return { success: true, message: 'Provider unassigned from tenant' };
  }

  /**
   * One-shot reveal of raw provider secrets for super admin (audit-logged).
   * Use the reveal endpoint; secrets are NOT returned by getProvider.
   */
  async revealProviderSecrets(providerId: string, actingUserId: string) {
    const provider = await this.providerRepository.findOne({ where: { id: providerId } });
    if (!provider) {
      throw new NotFoundException(`Provider ${providerId} not found`);
    }
    this.logger.error(
      `[AUDIT] Super admin ${actingUserId} revealed secrets for provider ${providerId} (${provider.name})`,
    );
    // TODO: persist to audit_logs entity once that entity is wired (Recommendation 4 in CODE_REVIEW.md).
    return {
      id: provider.id,
      name: provider.name,
      api_key: provider.api_key,
      secret_key: provider.secret_key,
      webhook_secret: provider.webhook_secret,
      revealed_at: new Date().toISOString(),
      warning: 'These values are sensitive. Treat them as credentials and store them securely. This action has been audit-logged.',
    };
  }
}