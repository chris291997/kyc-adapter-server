import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTenantAdminsTable1706000000007 implements MigrationInterface {
  name = 'DropTenantAdminsTable1706000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the tenant_admins table since we're using users table for everything
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_admins CASCADE;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate tenant_admins table if needed (for rollback)
    await queryRunner.query(`
      CREATE TABLE tenant_admins (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        status VARCHAR(20) DEFAULT 'active',
        permissions JSONB
      );
    `);
  }
}

