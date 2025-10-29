import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Provider } from '../database/entities/provider.entity';
import { TenantProviderConfig } from '../database/entities/tenant-provider-config.entity';
import { IKycProvider, ProviderCredentials, ProviderConfig } from './interfaces/kyc-provider.interface';
import { IDmetaProvider } from './implementations/idmeta/idmeta.provider';
// import { RegulaProvider } from './implementations/regula/regula.provider';
// import { PersonaProvider } from './implementations/persona/persona.provider';
import { MockProvider } from './implementations/mock/mock.provider';

@Injectable()
export class ProvidersFactory {
  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(TenantProviderConfig)
    private readonly configRepository: Repository<TenantProviderConfig>,
    private readonly idmetaProvider: IDmetaProvider,
    // private readonly regulaProvider: RegulaProvider,
    // private readonly personaProvider: PersonaProvider,
    private readonly mockProvider: MockProvider,
  ) {}

  /**
   * Get provider instance by database ID
   * This is the main method used throughout the application
   */
  async getProviderById(providerId: string): Promise<IKycProvider> {
    // 1. Fetch provider metadata from database
    const providerEntity = await this.providerRepository.findOne({
      where: { id: providerId, is_active: true }
    });

    if (!providerEntity) {
      throw new NotFoundException(`Provider ${providerId} not found`);
    }

    // 2. Resolve type (fallback by name) and map to provider instance
    const resolvedType = this.resolveType(providerEntity.type, providerEntity.name);
    const provider = this.getProviderInstance(resolvedType);

    // 3. Return the provider (will be initialized when first used)
    return provider;
  }

  /**
   * Get raw provider entity (with config) by ID
   */
  async getProviderEntityById(providerId: string): Promise<Provider | null> {
    return this.providerRepository.findOne({ where: { id: providerId, is_active: true } });
  }

  /**
   * Resolve provider by slug/name (e.g., 'idmeta') and return instance
   */
  async getProviderBySlug(slug: string): Promise<{ id: string; instance: IKycProvider }> {
    const normalized = (slug || '').toLowerCase();
    let providerEntity: Provider | null = null;

    // If slug matches enum type, search by type; otherwise search by name (case-insensitive)
    if (['single_step', 'multi_step', 'async_webhook', 'mock'].includes(normalized)) {
      providerEntity = await this.providerRepository.findOne({
        where: { type: normalized as any, is_active: true },
        order: { created_at: 'ASC' as any },
      });
    } else {
      providerEntity = await this.providerRepository.findOne({
        where: { name: ILike(slug), is_active: true },
        order: { created_at: 'ASC' as any },
      });
    }

    if (!providerEntity) {
      throw new NotFoundException(`Provider not found for slug ${slug}`);
    }

    const resolvedType = this.resolveType(providerEntity.type, providerEntity.name);
    const instance = this.getProviderInstance(resolvedType);
    return { id: providerEntity.id, instance };
  }

  /**
   * Map database provider type to concrete implementation
   */
  private getProviderInstance(type: 'single_step' | 'multi_step' | 'async_webhook' | 'mock'): IKycProvider {
    switch (type) {
      case 'multi_step':
        return this.idmetaProvider;
      
      case 'single_step':
        // return this.regulaProvider;
        return this.mockProvider; // Fallback to mock for now
      
      case 'async_webhook':
        // return this.personaProvider;
        return this.mockProvider; // Fallback to mock for now
      
      case 'mock':
        return this.mockProvider;
      
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }

  private resolveType(
    type: 'single_step' | 'multi_step' | 'async_webhook' | null | undefined,
    name: string,
  ): 'single_step' | 'multi_step' | 'async_webhook' | 'mock' {
    if (type) return type;
    const lower = (name || '').toLowerCase();
    if (lower === 'idmeta') return 'multi_step';
    if (lower === 'mock') return 'mock';
    // Default to mock when unknown
    return 'mock';
  }

  /**
   * Get provider assignment for a tenant (no credentials, just assignment)
   */
  async getProviderAssignment(
    tenantId: string,
    providerId: string
  ): Promise<TenantProviderConfig> {
    const config = await this.configRepository.findOne({
      where: { tenant_id: tenantId, provider_id: providerId, is_enabled: true },
      relations: ['provider'],
    });

    if (!config) {
      throw new NotFoundException('Provider not assigned to this tenant');
    }

    return config;
  }

  /**
   * Get the tenant's primary provider (highest priority enabled)
   * Returns both the assignment and the provider entity with full credentials
   */
  async getPrimaryProviderForTenant(tenantId: string): Promise<{ assignment: TenantProviderConfig; provider: Provider }> {
    const assignment = await this.configRepository.findOne({
      where: { tenant_id: tenantId, is_enabled: true },
      relations: ['provider'],
      order: { priority: 'ASC', created_at: 'ASC' as any },
    });

    if (!assignment) {
      throw new NotFoundException('No enabled provider assigned to this tenant');
    }

    return {
      assignment,
      provider: assignment.provider,
    };
  }

  /**
   * Legacy method for backward compatibility - will be deprecated
   */
  async getPrimaryProviderConfig(tenantId: string): Promise<TenantProviderConfig> {
    const assignment = await this.configRepository.findOne({
      where: { tenant_id: tenantId, is_enabled: true },
      relations: ['provider'],
      order: { priority: 'ASC', created_at: 'ASC' as any },
    });

    if (!assignment) {
      throw new NotFoundException('No enabled provider assigned to this tenant');
    }

    return assignment;
  }

  /**
   * Get all available providers
   */
  async getAllProviders(): Promise<IKycProvider[]> {
    const providers = await this.providerRepository.find({
      where: { is_active: true }
    });

    return providers.map(p => this.getProviderInstance(this.resolveType(p.type as any, p.name)));
  }

  /**
   * Get provider capabilities
   */
  async getProviderCapabilities(providerId: string): Promise<any> {
    const provider = await this.getProviderById(providerId);
    return provider.capabilities;
  }

  /**
   * Find providers that support a specific capability
   */
  async findProvidersWithCapability(
    capability: string
  ): Promise<IKycProvider[]> {
    const allProviders = await this.getAllProviders();
    
    return allProviders.filter(provider => 
      provider.capabilities[capability] === true
    );
  }
}
