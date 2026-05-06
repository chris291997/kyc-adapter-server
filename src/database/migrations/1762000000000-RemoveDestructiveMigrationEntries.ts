import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the historical entries for the three destructive "Clear*" migrations
 * that have been moved out of the migration sequence and into operational scripts.
 * This makes the migrations table consistent with the source tree on existing deployments.
 */
export class RemoveDestructiveMigrationEntries1762000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM migrations
      WHERE name IN (
        'ClearAccountsAndVerifications1730138400000',
        'ClearExistingData1761600000000',
        'ClearVerificationsAndAccounts1761800000000'
      );
    `);
  }

  public async down(): Promise<void> {
    // No-op: the entries point to source files that no longer exist.
  }
}
