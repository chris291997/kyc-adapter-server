import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateProviderFields1761500200000 implements MigrationInterface {
  name = 'UpdateProviderFields1761500200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make provider.type nullable
    await queryRunner.query(`
      ALTER TABLE "providers" 
      ALTER COLUMN "type" DROP NOT NULL
    `);

    // Make provider.api_version nullable
    await queryRunner.query(`
      ALTER TABLE "providers" 
      ALTER COLUMN "api_version" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert changes
    await queryRunner.query(`
      ALTER TABLE "providers" 
      ALTER COLUMN "type" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "providers" 
      ALTER COLUMN "api_version" SET NOT NULL
    `);
  }
}

