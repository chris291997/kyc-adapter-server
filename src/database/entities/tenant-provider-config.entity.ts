import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Provider } from './provider.entity';

@Entity('tenant_provider_configs')
@Unique(['tenant_id', 'provider_id'])
export class TenantProviderConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column('uuid')
  provider_id: string;

  // Priority for this provider assignment (lower = higher priority)
  @Column({ type: 'int', default: 1 })
  priority: number;

  // Whether this provider is enabled for this tenant
  @Column({ default: true })
  is_enabled: boolean;

  // Optional tenant-specific overrides (rarely used, prefer provider-level config)
  // Use cases: tenant-specific callback URLs, custom metadata
  @Column({ type: 'jsonb', nullable: true, default: null })
  tenant_overrides?: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Tenant, tenant => tenant.provider_configs)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Provider, provider => provider.tenant_configs)
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;
}


