import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Verification } from './verification.entity';
import { VerificationDocument } from './verification-document.entity';

export interface PersonName {
  first?: string;
  middle?: string;
  last?: string;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

@Entity('accounts')
@Index(['tenant_id'])
@Index(['tenant_id', 'reference_id'])
@Index(['tenant_id', 'email'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @Column({ nullable: true })
  reference_id: string; // Tenant's internal reference ID for this user

  @Column({ type: 'jsonb', nullable: true })
  name: PersonName;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'date', nullable: true })
  birthdate: Date;

  @Column({ type: 'jsonb', nullable: true })
  address: Address;

  @Column({ type: 'enum', enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' })
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';

  @Column({ nullable: true })
  last_verification_id: string; // ID of the most recent verification

  @Column({ type: 'jsonb', nullable: true })
  verified_data: Record<string, any>; // Verified data from KYC provider

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Additional tenant-specific data

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Tenant, tenant => tenant.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => Verification, verification => verification.account)
  verifications: Verification[];

  @OneToMany(() => VerificationDocument, document => document.account)
  documents: VerificationDocument[];

  // Helper methods
  getFullName(): string {
    if (!this.name) return '';
    const { first = '', middle = '', last = '' } = this.name;
    return [first, middle, last].filter(Boolean).join(' ');
  }

  getDisplayName(): string {
    return this.getFullName() || this.email || this.reference_id || this.id;
  }
}


