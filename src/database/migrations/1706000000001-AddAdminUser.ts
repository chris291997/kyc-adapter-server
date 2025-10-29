import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcryptjs';

export class AddAdminUser1706000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Hash the password
    const hashedPassword = await bcrypt.hash('123password', 10);
    
    // Insert admin user
    await queryRunner.query(`
      INSERT INTO admins (id, email, password_hash, name, role, status, created_at, updated_at)
      VALUES (
        uuid_generate_v4(),
        'admin@email.com',
        $1,
        'System Administrator',
        'admin',
        'active',
        NOW(),
        NOW()
      )
    `, [hashedPassword]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove admin user
    await queryRunner.query(`
      DELETE FROM admins WHERE email = 'admin@email.com'
    `);
  }
}
