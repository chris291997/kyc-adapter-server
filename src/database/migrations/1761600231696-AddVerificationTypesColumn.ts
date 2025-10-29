import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVerificationTypesColumn1761600231696 implements MigrationInterface {
  name = 'AddVerificationTypesColumn1761600231696';

    public async up(queryRunner: QueryRunner): Promise<void> {
    // Add verification_types column to verifications table
    await queryRunner.query(`
      ALTER TABLE "verifications" 
      ADD COLUMN IF NOT EXISTS "verification_types" jsonb NULL
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove verification_types column
    await queryRunner.query(`
      ALTER TABLE "verifications" 
      DROP COLUMN IF EXISTS "verification_types"
    `);
  }
}
