import { MigrationInterface, QueryRunner } from "typeorm";

export class FixApiKeyCreatedAt1761385042394 implements MigrationInterface {
    name = 'FixApiKeyCreatedAt1761385042394'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE api_keys
            ALTER COLUMN created_at SET DEFAULT NOW();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE api_keys
            ALTER COLUMN created_at DROP DEFAULT;
        `);
    }
}

