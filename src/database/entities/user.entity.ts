import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ApiKey } from './api-key.entity';
import { RefreshToken } from './refresh-token.entity';
import { Tenant } from './tenant.entity';

export interface PersonName {
  first?: string;
  middle?: string;
  last?: string;
}

@Entity('users')
@Index(['email'])
@Index(['user_type'])
@Index(['tenant_id'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column()
  name: string;

  @Column({ 
    type: 'enum', 
    enum: ['super_admin', 'tenant_admin', 'tenant_user'],
    default: 'tenant_user'
  })
  user_type: 'super_admin' | 'tenant_admin' | 'tenant_user';

  @Column({ 
    type: 'enum', 
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  })
  status: 'active' | 'inactive' | 'suspended';

  @Column('uuid', { nullable: true })
  tenant_id?: string;

  @Column({ type: 'jsonb', nullable: true })
  name_details?: PersonName;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ApiKey, apiKey => apiKey.user)
  api_keys: ApiKey[];

  @OneToMany(() => RefreshToken, refreshToken => refreshToken.user)
  refresh_tokens: RefreshToken[];

  @ManyToOne(() => Tenant, tenant => tenant.users)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  getFullName(): string {
    if (this.name_details) {
      const { first = '', middle = '', last = '' } = this.name_details;
      return [first, middle, last].filter(Boolean).join(' ');
    }
    return this.name;
  }

  getDisplayName(): string {
    return this.getFullName() || this.email;
  }

  isSuperAdmin(): boolean {
    return this.user_type === 'super_admin';
  }

  isTenantAdmin(): boolean {
    return this.user_type === 'tenant_admin';
  }

  isTenantUser(): boolean {
    return this.user_type === 'tenant_user';
  }

  belongsToTenant(tenantId: string): boolean {
    return this.tenant_id === tenantId;
  }
}
