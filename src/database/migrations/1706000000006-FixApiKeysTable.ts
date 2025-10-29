import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixApiKeysTable1706000000006 implements MigrationInterface {
  name = 'FixApiKeysTable1706000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, delete all existing API keys since they don't have proper user_id references
    await queryRunner.query(`DELETE FROM api_keys;`);
    
    // Remove the old tenant_id column from api_keys table
    await queryRunner.query(`ALTER TABLE api_keys DROP COLUMN IF EXISTS tenant_id;`);
    
    // Ensure user_id column exists and is properly set
    await queryRunner.query(`ALTER TABLE api_keys ALTER COLUMN user_id SET NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back tenant_id column for rollback
    await queryRunner.query(`ALTER TABLE api_keys ADD COLUMN tenant_id UUID;`);
    await queryRunner.query(`ALTER TABLE api_keys ALTER COLUMN user_id DROP NOT NULL;`);
  }
}
