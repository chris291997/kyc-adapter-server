import { MigrationInterface, QueryRunner } from 'typeorm';

export class CentralizeProviderConfig1761700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Centralizing provider configuration...');
    console.log('   Moving credentials from tenant_provider_configs to providers table');
    
    // 1. Add new columns to providers table
    await queryRunner.query(`
      ALTER TABLE providers 
      ADD COLUMN IF NOT EXISTS api_key VARCHAR,
      ADD COLUMN IF NOT EXISTS secret_key VARCHAR,
      ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR;
    `);
    console.log('   ✓ Added credential columns to providers table');

    // 2. Rename config column in tenant_provider_configs to tenant_overrides
    await queryRunner.query(`
      ALTER TABLE tenant_provider_configs 
      RENAME COLUMN config TO tenant_overrides;
    `);
    console.log('   ✓ Renamed config to tenant_overrides in tenant_provider_configs');

    // 3. Make tenant_overrides nullable and set default to null
    await queryRunner.query(`
      ALTER TABLE tenant_provider_configs 
      ALTER COLUMN tenant_overrides DROP NOT NULL,
      ALTER COLUMN tenant_overrides SET DEFAULT NULL;
    `);
    console.log('   ✓ Made tenant_overrides nullable');

    console.log('\n✅ Provider configuration centralized successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure providers via: PUT /admin/providers/:id');
    console.log('   2. Set credentials: api_key, secret_key, webhook_secret, base_url');
    console.log('   3. Assign providers to tenants via: POST /admin/tenants/:tenantId/providers/:providerId');
    console.log('   4. Webhook URL format: /v1/webhook/{provider-name-slug}');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Reverting provider configuration centralization...');
    
    // 1. Rename tenant_overrides back to config
    await queryRunner.query(`
      ALTER TABLE tenant_provider_configs 
      RENAME COLUMN tenant_overrides TO config;
    `);
    console.log('   ✓ Renamed tenant_overrides back to config');

    // 2. Make config non-nullable with default
    await queryRunner.query(`
      ALTER TABLE tenant_provider_configs 
      ALTER COLUMN config SET NOT NULL,
      ALTER COLUMN config SET DEFAULT '{}';
    `);
    console.log('   ✓ Restored config column constraints');

    // 3. Remove credential columns from providers table
    await queryRunner.query(`
      ALTER TABLE providers 
      DROP COLUMN IF EXISTS api_key,
      DROP COLUMN IF EXISTS secret_key,
      DROP COLUMN IF EXISTS webhook_secret;
    `);
    console.log('   ✓ Removed credential columns from providers table');
    
    console.log('\n✅ Migration reverted.');
  }
}

