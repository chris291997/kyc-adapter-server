import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountEntity1706000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create accounts table
    await queryRunner.query(`
      CREATE TABLE accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        reference_id VARCHAR(255),
        name JSONB,
        email VARCHAR(255),
        phone VARCHAR(50),
        birthdate DATE,
        address JSONB,
        verification_status VARCHAR(20) DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
        last_verification_id UUID,
        verified_data JSONB,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX idx_accounts_tenant_id ON accounts(tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_accounts_tenant_reference ON accounts(tenant_id, reference_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_accounts_tenant_email ON accounts(tenant_id, email);
    `);

    // Add account_id column to verifications table
    await queryRunner.query(`
      ALTER TABLE verifications 
      ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX idx_verifications_account_id ON verifications(account_id);
    `);

    // Add account_id column to verification_documents table
    await queryRunner.query(`
      ALTER TABLE verification_documents 
      ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX idx_verification_documents_account_id ON verification_documents(account_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes and columns from verification_documents
    await queryRunner.query(`DROP INDEX IF EXISTS idx_verification_documents_account_id;`);
    await queryRunner.query(`ALTER TABLE verification_documents DROP COLUMN IF EXISTS account_id;`);

    // Drop indexes and columns from verifications
    await queryRunner.query(`DROP INDEX IF EXISTS idx_verifications_account_id;`);
    await queryRunner.query(`ALTER TABLE verifications DROP COLUMN IF EXISTS account_id;`);

    // Drop accounts table indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_accounts_tenant_email;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_accounts_tenant_reference;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_accounts_tenant_id;`);

    // Drop accounts table
    await queryRunner.query(`DROP TABLE IF EXISTS accounts;`);
  }
}

