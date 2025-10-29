import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAdminsTable1706000000005 implements MigrationInterface {
  name = 'DropAdminsTable1706000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the admins table since we're using users table for everything
    await queryRunner.query(`DROP TABLE IF EXISTS admins CASCADE;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate admins table if needed (for rollback)
    await queryRunner.query(`
      CREATE TABLE admins (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  }
}

