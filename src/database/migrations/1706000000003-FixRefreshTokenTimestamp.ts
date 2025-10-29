import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixRefreshTokenTimestamp1706000000003 implements MigrationInterface {
  name = 'FixRefreshTokenTimestamp1706000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add default value to created_at column in refresh_tokens table
    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      ALTER COLUMN created_at SET DEFAULT NOW();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove default value from created_at column
    await queryRunner.query(`
      ALTER TABLE refresh_tokens
      ALTER COLUMN created_at DROP DEFAULT;
    `);
  }
}


