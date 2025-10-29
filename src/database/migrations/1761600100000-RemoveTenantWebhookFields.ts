import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTenantWebhookFields1761600100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Removing webhook fields from tenants table...');
    console.log('   Webhooks are now provider-level, managed by super_admin only.');
    
    // Remove webhook-related columns from tenants table
    await queryRunner.query('ALTER TABLE tenants DROP COLUMN IF EXISTS webhook_url;');
    console.log('   ✓ Removed webhook_url column');
    
    await queryRunner.query('ALTER TABLE tenants DROP COLUMN IF EXISTS webhook_events;');
    console.log('   ✓ Removed webhook_events column');
    
    await queryRunner.query('ALTER TABLE tenants DROP COLUMN IF EXISTS webhook_secret;');
    console.log('   ✓ Removed webhook_secret column');
    
    console.log('\n✅ Tenant webhook fields removed successfully!');
    console.log('   Note: Webhooks are now managed at provider level via:');
    console.log('   - Static endpoint: /v1/webhook/{PROVIDER_NAME}');
    console.log('   - Secret stored in providers.config (super_admin only)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Restoring webhook fields to tenants table...');
    
    // Restore webhook-related columns
    await queryRunner.query('ALTER TABLE tenants ADD COLUMN webhook_url VARCHAR;');
    console.log('   ✓ Restored webhook_url column');
    
    await queryRunner.query('ALTER TABLE tenants ADD COLUMN webhook_events JSONB;');
    console.log('   ✓ Restored webhook_events column');
    
    await queryRunner.query('ALTER TABLE tenants ADD COLUMN webhook_secret VARCHAR;');
    console.log('   ✓ Restored webhook_secret column');
    
    console.log('\n✅ Tenant webhook fields restored.');
  }
}

