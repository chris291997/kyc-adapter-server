import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClearAccountsAndVerifications1730138400000 implements MigrationInterface {
  name = 'ClearAccountsAndVerifications1730138400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Delete all verification documents first (foreign key constraint)
    await queryRunner.query(`DELETE FROM "verification_documents"`);
    
    // Delete all webhook logs (foreign key constraint)
    await queryRunner.query(`DELETE FROM "webhook_logs" WHERE verification_id IS NOT NULL`);
    
    // Delete all verifications
    await queryRunner.query(`DELETE FROM "verifications"`);
    
    // Delete all accounts
    await queryRunner.query(`DELETE FROM "accounts"`);
    
    console.log('✅ All accounts and verifications cleared successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot undo data deletion
    console.log('⚠️ Cannot restore deleted data');
  }
}






