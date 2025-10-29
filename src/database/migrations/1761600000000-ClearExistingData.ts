import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClearExistingData1761600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Disable foreign key checks temporarily for easier deletion
    await queryRunner.query('SET session_replication_role = replica;');

    try {
      // Delete in order of dependencies (child tables first)
      
      // 1. Clear verifications (depends on accounts, tenant_provider_configs)
      await queryRunner.query('DELETE FROM verifications;');
      console.log('✓ Cleared verifications table');

      // 2. Clear accounts (depends on tenants)
      await queryRunner.query('DELETE FROM accounts;');
      console.log('✓ Cleared accounts table');

      // 3. Clear API keys (depends on tenants)
      await queryRunner.query('DELETE FROM api_keys;');
      console.log('✓ Cleared api_keys table');

      // 4. Clear tenant provider configs (depends on tenants, providers)
      await queryRunner.query('DELETE FROM tenant_provider_configs;');
      console.log('✓ Cleared tenant_provider_configs table');

      // 5. Clear refresh tokens (depends on users)
      await queryRunner.query('DELETE FROM refresh_tokens;');
      console.log('✓ Cleared refresh_tokens table');

      // 6. Clear users (depends on tenants) - but keep super_admin users
      await queryRunner.query(
        "DELETE FROM users WHERE user_type != 'super_admin';"
      );
      console.log('✓ Cleared tenant users (kept super_admin users)');

      // 7. Clear tenants (parent table)
      await queryRunner.query('DELETE FROM tenants;');
      console.log('✓ Cleared tenants table');

      // 8. Clear providers (parent table)
      await queryRunner.query('DELETE FROM providers;');
      console.log('✓ Cleared providers table');

      console.log('\n✅ All existing data cleared successfully!');
      console.log('Note: Super admin users were preserved.');
    } finally {
      // Re-enable foreign key checks
      await queryRunner.query('SET session_replication_role = DEFAULT;');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This migration cannot be reverted as we're deleting data
    // If you need to restore data, use a database backup
    console.log(
      '⚠️  This migration deletes data and cannot be automatically reverted.'
    );
    console.log('Please restore from a database backup if needed.');
  }
}

