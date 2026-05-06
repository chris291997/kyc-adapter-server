import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { TenantProviderConfig } from './tenant-provider-config.entity';
import { Verification } from './verification.entity';
import { WebhookLog } from './webhook-log.entity';
import { encryptedColumnTransformer } from '../transformers/encrypted-column.transformer';

@Entity('providers')
export class Provider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'enum', enum: ['single_step', 'multi_step', 'async_webhook'], nullable: true })
  type?: 'single_step' | 'multi_step' | 'async_webhook';

  @Column({ nullable: true })
  api_version?: string;

  @Column()
  base_url: string;

  // Provider credentials (centralized)
  @Column({ nullable: true, transformer: encryptedColumnTransformer })
  api_key?: string;

  @Column({ nullable: true, transformer: encryptedColumnTransformer })
  secret_key?: string;

  @Column({ nullable: true, transformer: encryptedColumnTransformer })
  webhook_secret?: string;

  // Auto-generated webhook endpoint (read-only, computed from name)
  // Format: /v1/webhook/{url-safe-provider-name}
  // This is stored for reference but can be computed

  @Column({ default: false })
  supports_webhooks: boolean;

  @Column({ default: false })
  supports_multi_step: boolean;

  @Column({ default: false })
  supports_hosted_workflow: boolean;

  @Column({ default: true })
  is_active: boolean;

  // Additional provider-specific configuration (timeouts, retry attempts, etc.)
  @Column({ type: 'jsonb', default: '{}' })
  config: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => TenantProviderConfig, config => config.provider)
  tenant_configs: TenantProviderConfig[];

  @OneToMany(() => Verification, verification => verification.provider)
  verifications: Verification[];

  @OneToMany(() => WebhookLog, webhookLog => webhookLog.provider)
  webhook_logs: WebhookLog[];
}

