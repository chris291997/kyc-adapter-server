import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ unique: true })
  key_hash: string;

  @Column()
  key_prefix: string;

  @Column()
  name: string;

  @Column({ type: 'jsonb' })
  scopes: string[];

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  last_used_at: Date;

  @Column({ nullable: true })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, user => user.api_keys)
  @JoinColumn({ name: 'user_id' })
  user: User;
}

