import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Verification } from './verification.entity';
import { Account } from './account.entity';

@Entity('verification_documents')
export class VerificationDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  verification_id: string;

  @Column('uuid', { nullable: true })
  account_id: string;

  @Column({ 
    type: 'enum', 
    enum: [
      'id_front', 
      'id_back', 
      'passport', 
      'drivers_license_front', 
      'drivers_license_back', 
      'selfie', 
      'proof_of_address'
    ]
  })
  document_type: 'id_front' | 'id_back' | 'passport' | 'drivers_license_front' | 'drivers_license_back' | 'selfie' | 'proof_of_address';

  @Column({ type: 'text' })
  file_url: string;

  @Column({ type: 'int' })
  file_size: number;

  @Column()
  mime_type: string;

  @Column()
  uploaded_at: Date;

  @ManyToOne(() => Verification, verification => verification.documents)
  @JoinColumn({ name: 'verification_id' })
  verification: Verification;

  @ManyToOne(() => Account, account => account.documents)
  @JoinColumn({ name: 'account_id' })
  account: Account;
}

