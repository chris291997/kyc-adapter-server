import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { TenantProviderConfig } from './tenant-provider-config.entity';
import { Verification } from './verification.entity';
import { Account } from './account.entity';
import { User } from './user.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'enum', enum: ['active', 'inactive', 'suspended'], default: 'active' })
  status: 'active' | 'inactive' | 'suspended';

  @Column({ type: 'int', default: 1000 })
  quota_limit: number;

  @Column({ type: 'int', default: 0 })
  quota_used: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => TenantProviderConfig, config => config.tenant)
  provider_configs: TenantProviderConfig[];

  @OneToMany(() => Verification, verification => verification.tenant)
  verifications: Verification[];

  @OneToMany(() => Account, account => account.tenant)
  accounts: Account[];

  @OneToMany(() => User, user => user.tenant)
  users: User[];
}

