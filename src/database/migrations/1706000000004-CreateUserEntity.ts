import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserEntity1706000000004 implements MigrationInterface {
  name = 'CreateUserEntity1706000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        user_type VARCHAR(20) DEFAULT 'tenant_user' CHECK (user_type IN ('super_admin', 'tenant_admin', 'tenant_user')),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        name_details JSONB,
        phone VARCHAR(50),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX idx_users_email ON users(email);`);
    await queryRunner.query(`CREATE INDEX idx_users_user_type ON users(user_type);`);
    await queryRunner.query(`CREATE INDEX idx_users_tenant_id ON users(tenant_id);`);

    // Update api_keys table to reference users instead of tenants
    await queryRunner.query(`ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS "FK_api_keys_tenant_id";`);
    await queryRunner.query(`ALTER TABLE api_keys ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);`);

    // Update refresh_tokens table to reference users
    await queryRunner.query(`ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS owner_id;`);
    await queryRunner.query(`ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS owner_type;`);
    await queryRunner.query(`ALTER TABLE refresh_tokens ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);`);

    // Remove password_hash from tenants table since users will handle authentication
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS password_hash;`);

    // Create super admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('123password', 10);
    
    await queryRunner.query(`
      INSERT INTO users (id, email, password_hash, name, user_type, status, created_at, updated_at)
      VALUES (
        uuid_generate_v4(),
        'admin@email.com',
        $1,
        'System Administrator',
        'super_admin',
        'active',
        NOW(),
        NOW()
      )
    `, [hashedPassword]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove super admin user
    await queryRunner.query(`DELETE FROM users WHERE email = 'admin@email.com';`);

    // Restore password_hash to tenants table
    await queryRunner.query(`ALTER TABLE tenants ADD COLUMN password_hash VARCHAR(255);`);

    // Restore refresh_tokens table
    await queryRunner.query(`DROP INDEX idx_refresh_tokens_user_id;`);
    await queryRunner.query(`ALTER TABLE refresh_tokens DROP COLUMN user_id;`);
    await queryRunner.query(`ALTER TABLE refresh_tokens ADD COLUMN owner_id UUID;`);
    await queryRunner.query(`ALTER TABLE refresh_tokens ADD COLUMN owner_type VARCHAR(20) CHECK (owner_type IN ('admin', 'tenant'));`);

    // Restore api_keys table
    await queryRunner.query(`DROP INDEX idx_api_keys_user_id;`);
    await queryRunner.query(`ALTER TABLE api_keys DROP COLUMN user_id;`);
    await queryRunner.query(`ALTER TABLE api_keys ADD CONSTRAINT "FK_api_keys_tenant_id" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;`);

    // Drop users table
    await queryRunner.query(`DROP INDEX idx_users_tenant_id;`);
    await queryRunner.query(`DROP INDEX idx_users_user_type;`);
    await queryRunner.query(`DROP INDEX idx_users_email;`);
    await queryRunner.query(`DROP TABLE users;`);
  }
}

