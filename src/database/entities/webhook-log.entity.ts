import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Provider } from './provider.entity';
import { Verification } from './verification.entity';

@Entity('webhook_logs')
export class WebhookLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  provider_id: string;

  @Column('uuid', { nullable: true })
  verification_id: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ nullable: true })
  signature: string;

  @Column({ 
    type: 'enum', 
    enum: ['received', 'processing', 'processed', 'failed', 'retrying'],
    default: 'received'
  })
  status: 'received' | 'processing' | 'processed' | 'failed' | 'retrying';

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column()
  received_at: Date;

  @Column({ nullable: true })
  processed_at: Date;

  @ManyToOne(() => Provider, provider => provider.webhook_logs)
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @ManyToOne(() => Verification, verification => verification.webhook_logs)
  @JoinColumn({ name: 'verification_id' })
  verification: Verification;
}

