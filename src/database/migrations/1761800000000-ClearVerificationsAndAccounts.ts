import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to clear verifications, accounts, and related data
 * while preserving admin users, providers, tenants, tenant configs, and API keys
 */
export class ClearVerificationsAndAccounts1761800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Disable foreign key checks temporarily for easier deletion
    await queryRunner.query('SET session_replication_role = replica;');

    try {
      console.log('\n🧹 Starting cleanup of verifications and accounts...\n');

      // Delete in order of dependencies (child tables first)
      
      // 1. Clear webhook logs (depends on verifications, providers)
      // We keep providers, but delete webhook logs related to verifications
      await queryRunner.query('DELETE FROM webhook_logs WHERE verification_id IS NOT NULL;');
      console.log('✓ Cleared webhook_logs (verification-related entries)');

      // 2. Clear verification documents (depends on verifications, accounts)
      await queryRunner.query('DELETE FROM verification_documents;');
      console.log('✓ Cleared verification_documents table');

      // 3. Clear verifications (depends on accounts, tenant_provider_configs, tenants, providers)
      await queryRunner.query('DELETE FROM verifications;');
      console.log('✓ Cleared verifications table');

      // 4. Clear accounts (depends on tenants)
      await queryRunner.query('DELETE FROM accounts;');
      console.log('✓ Cleared accounts table');

      // 5. Clear audit logs related to verifications/accounts (if exists and has correct structure)
      try {
        // Check if audit_logs table exists and has entity_type column
        const auditLogsCheck = await queryRunner.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'audit_logs' 
          AND column_name = 'entity_type';
        `);
        
        if (auditLogsCheck && auditLogsCheck.length > 0) {
          await queryRunner.query(`DELETE FROM audit_logs WHERE entity_type IN ('verification', 'account');`);
          console.log('✓ Cleared audit_logs (verification/account related entries)');
        } else {
          console.log('⚠️  audit_logs table does not have entity_type column, skipping');
        }
      } catch (error) {
        // Table might not exist or have different structure, ignore gracefully
        console.log('⚠️  Could not clear audit_logs (table may not exist or have different structure)');
      }

      console.log('\n✅ Verification and account data cleared successfully!');
      console.log('📋 Preserved data:');
      console.log('   - Admin users (super_admin)');
      console.log('   - Providers');
      console.log('   - Tenants');
      console.log('   - Tenant provider configs');
      console.log('   - API keys');
      console.log('   - Refresh tokens');
      console.log('   - Regular users (tenant users)');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      throw error;
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

