import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Provider } from './provider.entity';
import { VerificationDocument } from './verification-document.entity';
import { WebhookLog } from './webhook-log.entity';
import { Account } from './account.entity';

@Entity('verifications')
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column('uuid')
  provider_id: string;

  @Column('uuid', { nullable: true })
  account_id: string;

  @Column({ 
    type: 'enum', 
    enum: ['pending', 'processing', 'needs_review', 'approved', 'verified', 'rejected', 'expired', 'cancelled'],
    default: 'pending'
  })
  status: 'pending' | 'processing' | 'needs_review' | 'approved' | 'verified' | 'rejected' | 'expired' | 'cancelled';

  @Column()
  verification_type: string;

  @Column({ type: 'jsonb', nullable: true, name: 'verification_types' })
  verification_types: string[];

  @Column({ nullable: true })
  external_verification_id: string;

  @Column({ type: 'text', nullable: true })
  external_workflow_url: string;

  @Column({ nullable: true })
  user_email: string;

  @Column({ nullable: true })
  user_phone: string;

  @Column({ type: 'jsonb', nullable: true })
  user_metadata: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  provider_response: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  validated_user_data: Record<string, any>;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidence_score: number;

  @Column({ default: false })
  is_overridden: boolean;

  @Column('uuid', { nullable: true })
  overridden_by: string;

  @Column({ nullable: true })
  overridden_at: Date;

  @Column({ type: 'text', nullable: true })
  override_reason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  callback_url: string;

  @Column({ nullable: true })
  webhook_received_at: Date;

  @Column({ nullable: true })
  last_webhook_event: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Tenant, tenant => tenant.verifications)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Provider, provider => provider.verifications)
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @ManyToOne(() => Account, account => account.verifications)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @OneToMany(() => VerificationDocument, document => document.verification)
  documents: VerificationDocument[];

  @OneToMany(() => WebhookLog, webhookLog => webhookLog.verification)
  webhook_logs: WebhookLog[];
}
