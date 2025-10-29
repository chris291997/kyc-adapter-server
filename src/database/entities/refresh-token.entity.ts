import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ unique: true })
  token_hash: string;

  @Column()
  expires_at: Date;

  @Column({ nullable: true })
  revoked_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, user => user.refresh_tokens)
  @JoinColumn({ name: 'user_id' })
  user: User;
}

