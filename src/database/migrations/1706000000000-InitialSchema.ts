import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1706000000000 implements MigrationInterface {
  name = 'InitialSchema1706000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create admins table
    await queryRunner.query(`
      CREATE TABLE "admins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "name" character varying NOT NULL,
        "role" character varying NOT NULL DEFAULT 'admin',
        "status" character varying NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admins" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_admins_email" UNIQUE ("email")
      )
    `);

    // Create tenants table
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "quota_limit" integer NOT NULL DEFAULT 1000,
        "quota_used" integer NOT NULL DEFAULT 0,
        "webhook_url" character varying,
        "webhook_events" jsonb,
        "webhook_secret" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenants" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tenants_email" UNIQUE ("email")
      )
    `);

    // Create providers table
    await queryRunner.query(`
      CREATE TABLE "providers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "type" character varying NOT NULL,
        "api_version" character varying NOT NULL,
        "base_url" character varying NOT NULL,
        "supports_webhooks" boolean NOT NULL DEFAULT false,
        "supports_multi_step" boolean NOT NULL DEFAULT false,
        "supports_hosted_workflow" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "config" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_providers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_providers_name" UNIQUE ("name")
      )
    `);

    // Create tenant_provider_configs table
    await queryRunner.query(`
      CREATE TABLE "tenant_provider_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "provider_id" uuid NOT NULL,
        "config" jsonb NOT NULL,
        "priority" integer NOT NULL DEFAULT 1,
        "is_enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_provider_configs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tenant_provider_configs_tenant_provider" UNIQUE ("tenant_id", "provider_id")
      )
    `);

    // Create verifications table
    await queryRunner.query(`
      CREATE TABLE "verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "provider_id" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "verification_type" character varying NOT NULL,
        "external_verification_id" character varying,
        "external_workflow_url" text,
        "user_email" character varying,
        "user_phone" character varying,
        "user_metadata" jsonb,
        "provider_response" jsonb,
        "validated_user_data" jsonb,
        "confidence_score" decimal(5,2),
        "is_overridden" boolean NOT NULL DEFAULT false,
        "overridden_by" uuid,
        "overridden_at" TIMESTAMP,
        "override_reason" text,
        "metadata" jsonb,
        "callback_url" character varying,
        "webhook_received_at" TIMESTAMP,
        "last_webhook_event" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verifications" PRIMARY KEY ("id")
      )
    `);

    // Create verification_documents table
    await queryRunner.query(`
      CREATE TABLE "verification_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "verification_id" uuid NOT NULL,
        "document_type" character varying NOT NULL,
        "file_url" text NOT NULL,
        "file_size" integer NOT NULL,
        "mime_type" character varying NOT NULL,
        "uploaded_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_verification_documents" PRIMARY KEY ("id")
      )
    `);

    // Create webhook_logs table
    await queryRunner.query(`
      CREATE TABLE "webhook_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider_id" uuid NOT NULL,
        "verification_id" uuid,
        "payload" jsonb NOT NULL,
        "signature" character varying,
        "status" character varying NOT NULL DEFAULT 'received',
        "error_message" text,
        "received_at" TIMESTAMP NOT NULL,
        "processed_at" TIMESTAMP,
        CONSTRAINT "PK_webhook_logs" PRIMARY KEY ("id")
      )
    `);

    // Create api_keys table
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "key_hash" character varying NOT NULL,
        "key_prefix" character varying NOT NULL,
        "name" character varying NOT NULL,
        "scopes" jsonb NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_used_at" TIMESTAMP,
        "expires_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_api_keys_key_hash" UNIQUE ("key_hash")
      )
    `);

    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_id" uuid NOT NULL,
        "owner_type" character varying NOT NULL,
        "token_hash" character varying NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "revoked_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_refresh_tokens_token_hash" UNIQUE ("token_hash")
      )
    `);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "user_type" character varying NOT NULL,
        "action" character varying NOT NULL,
        "resource_type" character varying NOT NULL,
        "resource_id" uuid NOT NULL,
        "changes" jsonb,
        "ip_address" character varying,
        "user_agent" text,
        "created_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "tenant_provider_configs" 
      ADD CONSTRAINT "FK_tenant_provider_configs_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "tenant_provider_configs" 
      ADD CONSTRAINT "FK_tenant_provider_configs_provider" 
      FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "verifications" 
      ADD CONSTRAINT "FK_verifications_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "verifications" 
      ADD CONSTRAINT "FK_verifications_provider" 
      FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "verification_documents" 
      ADD CONSTRAINT "FK_verification_documents_verification" 
      FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "webhook_logs" 
      ADD CONSTRAINT "FK_webhook_logs_provider" 
      FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "webhook_logs" 
      ADD CONSTRAINT "FK_webhook_logs_verification" 
      FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "api_keys" 
      ADD CONSTRAINT "FK_api_keys_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
    `);

    // Create indexes for performance
    await queryRunner.query(`CREATE INDEX "IDX_verifications_tenant_id" ON "verifications" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_verifications_status" ON "verifications" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_verifications_created_at" ON "verifications" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_verifications_external_id" ON "verifications" ("external_verification_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_logs_provider_id" ON "webhook_logs" ("provider_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_logs_verification_id" ON "webhook_logs" ("verification_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_logs_received_at" ON "webhook_logs" ("received_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_resource_id" ON "audit_logs" ("resource_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_resource_id"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_webhook_logs_received_at"`);
    await queryRunner.query(`DROP INDEX "IDX_webhook_logs_verification_id"`);
    await queryRunner.query(`DROP INDEX "IDX_webhook_logs_provider_id"`);
    await queryRunner.query(`DROP INDEX "IDX_verifications_external_id"`);
    await queryRunner.query(`DROP INDEX "IDX_verifications_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_verifications_status"`);
    await queryRunner.query(`DROP INDEX "IDX_verifications_tenant_id"`);

    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "api_keys" DROP CONSTRAINT "FK_api_keys_tenant"`);
    await queryRunner.query(`ALTER TABLE "webhook_logs" DROP CONSTRAINT "FK_webhook_logs_verification"`);
    await queryRunner.query(`ALTER TABLE "webhook_logs" DROP CONSTRAINT "FK_webhook_logs_provider"`);
    await queryRunner.query(`ALTER TABLE "verification_documents" DROP CONSTRAINT "FK_verification_documents_verification"`);
    await queryRunner.query(`ALTER TABLE "verifications" DROP CONSTRAINT "FK_verifications_provider"`);
    await queryRunner.query(`ALTER TABLE "verifications" DROP CONSTRAINT "FK_verifications_tenant"`);
    await queryRunner.query(`ALTER TABLE "tenant_provider_configs" DROP CONSTRAINT "FK_tenant_provider_configs_provider"`);
    await queryRunner.query(`ALTER TABLE "tenant_provider_configs" DROP CONSTRAINT "FK_tenant_provider_configs_tenant"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
    await queryRunner.query(`DROP TABLE "webhook_logs"`);
    await queryRunner.query(`DROP TABLE "verification_documents"`);
    await queryRunner.query(`DROP TABLE "verifications"`);
    await queryRunner.query(`DROP TABLE "tenant_provider_configs"`);
    await queryRunner.query(`DROP TABLE "providers"`);
    await queryRunner.query(`DROP TABLE "tenants"`);
    await queryRunner.query(`DROP TABLE "admins"`);
  }
}
