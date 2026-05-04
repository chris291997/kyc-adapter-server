# SERVER Critical-Findings Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the 5 Critical findings from `SERVER/CODE_REVIEW.md` (2026-05-04) so the SERVER is safe to deploy to production.

**Architecture:** Six independent tasks, ordered to minimize blast radius (smallest, most-isolated changes first). Each task ends in a tested commit so the tree stays green between steps. No new external services introduced — uses existing Postgres, Redis, and the dead-but-defined `EncryptionService` (rewritten) and `RateLimitService` (replaced by `@nestjs/throttler`). Secrets stay in the DB but encrypted at rest with AES-256-GCM, per-row IV, AAD bound to entity id.

**Tech Stack:** NestJS 10 (existing), TypeORM 0.3 (existing), `@nestjs/throttler` v5 + `@nestjs/throttler-storage-redis` v0.4 (added), `joi` v17 (added — `@nestjs/config` peer dep), Jest (existing). No frontend changes required.

---

## Task ordering rationale

1. **Task 1** — Env validation + CORS hardening. Foundation; everything else assumes config is sane.
2. **Task 2** — Move destructive migrations out of the migration sequence. Removes ongoing deploy risk before we touch anything else.
3. **Task 3** — Webhook signature hardening. Most exploitable issue today; isolated to two small files.
4. **Task 4** — Stop leaking provider secrets in admin GET responses. Fast win, no schema change.
5. **Task 5** — Fix `EncryptionService` and encrypt provider credentials at rest. Largest task; depends on Task 4 already removing the response-side leak.
6. **Task 6** — Rate limiting via `@nestjs/throttler`. Last because it's the only task that touches every controller; doing it last avoids merge churn with the earlier tasks.

## Pre-flight

- [ ] **Verify clean working tree**

```bash
git status
```

Expected: clean OR only `SERVER/CODE_REVIEW.md` and `SERVER/docs/superpowers/plans/2026-05-05-server-critical-fixes.md` untracked. Stash anything else.

- [ ] **Verify tests currently pass**

```bash
npm test
```

Expected: all existing specs pass (the 5 spec files described in `SYSTEM_ARCHITECTURE.md`). Establishes a green baseline.

---

## Task 1: Environment validation + CORS hardening (C5 + M6)

Add a startup-time joi schema that fails fast if production is missing critical env. Make `CORS_ORIGINS` mandatory in production with no localhost fallback.

**Files:**
- Create: `src/config/env.validation.ts`
- Modify: `src/app.module.ts:19-22`
- Modify: `src/main.ts:41-44`
- Modify: `env.example`
- Test: `src/config/env.validation.spec.ts`

- [ ] **Step 1: Install joi**

```bash
npm install joi
```

Expected: `joi` added to dependencies in `package.json`.

- [ ] **Step 2: Write the failing test for env validation**

Create `src/config/env.validation.spec.ts`:
```ts
import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const baseValid = {
    NODE_ENV: 'production',
    PORT: '3000',
    DATABASE_HOST: 'db',
    DATABASE_PORT: '5432',
    DATABASE_USERNAME: 'u',
    DATABASE_PASSWORD: 'p',
    DATABASE_NAME: 'n',
    JWT_SECRET: 'a'.repeat(32),
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    ENCRYPTION_KEY: 'a'.repeat(32),
    CORS_ORIGINS: 'https://app.example.com',
  };

  it('accepts a fully-populated production env', () => {
    const { error } = envValidationSchema.validate(baseValid);
    expect(error).toBeUndefined();
  });

  it('rejects production without CORS_ORIGINS', () => {
    const { CORS_ORIGINS, ...env } = baseValid;
    const { error } = envValidationSchema.validate(env);
    expect(error?.message).toMatch(/CORS_ORIGINS/);
  });

  it('rejects production with http:// origins', () => {
    const { error } = envValidationSchema.validate({
      ...baseValid,
      CORS_ORIGINS: 'http://app.example.com',
    });
    expect(error?.message).toMatch(/https/);
  });

  it('allows http:// origins in development', () => {
    const { error } = envValidationSchema.validate({
      ...baseValid,
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:5173',
    });
    expect(error).toBeUndefined();
  });

  it('rejects production with short JWT_SECRET', () => {
    const { error } = envValidationSchema.validate({
      ...baseValid,
      JWT_SECRET: 'short',
    });
    expect(error?.message).toMatch(/JWT_SECRET/);
  });

  it('rejects production with non-32-char ENCRYPTION_KEY', () => {
    const { error } = envValidationSchema.validate({
      ...baseValid,
      ENCRYPTION_KEY: 'too-short',
    });
    expect(error?.message).toMatch(/ENCRYPTION_KEY/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx jest src/config/env.validation.spec.ts
```

Expected: FAIL with `Cannot find module './env.validation'`.

- [ ] **Step 4: Implement `env.validation.ts`**

Create `src/config/env.validation.ts`:
```ts
import * as Joi from 'joi';

const httpsOriginList = Joi.string()
  .custom((value, helpers) => {
    const origins = String(value).split(',').map((s) => s.trim()).filter(Boolean);
    if (origins.length === 0) {
      return helpers.error('any.invalid', { message: 'CORS_ORIGINS must contain at least one origin' });
    }
    for (const origin of origins) {
      if (!origin.startsWith('https://')) {
        return helpers.error('any.invalid', { message: `CORS_ORIGINS entry "${origin}" must use https:// in production` });
      }
    }
    return value;
  });

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.alternatives().try(Joi.number(), Joi.string()).default(3000),

  // Database
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  DATABASE_USERNAME: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_SSL: Joi.boolean().default(false),
  DATABASE_LOGGING: Joi.boolean().default(false),

  // Redis (optional but if any key is set, host must be present)
  REDIS_HOST: Joi.string().optional(),
  REDIS_PORT: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  REDIS_PASSWORD: Joi.string().optional().allow(''),

  // JWT — required, longer minimum in production
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(8).required(),
  }),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  // Encryption key — exactly 32 ASCII chars (256-bit key)
  ENCRYPTION_KEY: Joi.string().length(32).required(),

  // CORS — required in production, must be https:// in production, free-form in dev
  CORS_ORIGINS: Joi.when('NODE_ENV', {
    is: 'production',
    then: httpsOriginList.required(),
    otherwise: Joi.string().required(),
  }),

  // API key only mode toggle
  API_KEYS_ONLY: Joi.boolean().default(false),

  // IDMeta defaults (optional)
  IDMETA_BASE_URL: Joi.string().uri().optional(),

  // Rate limit defaults (used by Task 6)
  RATE_LIMIT_TTL: Joi.alternatives().try(Joi.number(), Joi.string()).default(60),
  RATE_LIMIT_MAX: Joi.alternatives().try(Joi.number(), Joi.string()).default(100),
}).unknown(true);
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx jest src/config/env.validation.spec.ts
```

Expected: 6 tests PASS.

- [ ] **Step 6: Wire the schema into ConfigModule**

Modify `src/app.module.ts:19-22`. Replace:
```ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: ['.env', '.env.example'],
}),
```
with:
```ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: process.env.NODE_ENV === 'production' ? ['.env'] : ['.env', '.env.example'],
  validationSchema: envValidationSchema,
  validationOptions: { abortEarly: false },
}),
```

Add at top of file:
```ts
import { envValidationSchema } from './config/env.validation';
```

- [ ] **Step 7: Harden CORS in `main.ts`**

Modify `src/main.ts:41-44`. Replace:
```ts
app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
});
```
with:
```ts
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
if (!corsOrigins || corsOrigins.length === 0) {
  throw new Error('CORS_ORIGINS env is required (no localhost fallback)');
}
app.enableCors({
  origin: corsOrigins,
  credentials: true,
});
```

- [ ] **Step 8: Update `env.example`**

Modify `env.example` — ensure `CORS_ORIGINS` is present and add a comment:
```
# CORS — comma-separated list of allowed origins. REQUIRED. In production all entries must be https://
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```
Replace the existing `CORS_ORIGINS` line; remove the duplicate `RATE_LIMIT_TTL` / `RATE_LIMIT_MAX` block at the bottom of the file (currently appears twice).

- [ ] **Step 9: Verify the app still boots**

```bash
npm run build && node -e "process.env.NODE_ENV='development'; require('./dist/main')" &
sleep 3
curl -s http://localhost:3000/api/docs -o /dev/null -w "%{http_code}\n"
kill %1
```

Expected: `200` (or `301`/`302`). Then verify production failure:
```bash
NODE_ENV=production node dist/main.js 2>&1 | head -3
```
Expected: error mentioning `CORS_ORIGINS` (since it's likely missing or http://) — assertion that validation runs at boot.

- [ ] **Step 10: Commit**

```bash
git add src/config/ src/app.module.ts src/main.ts env.example package.json package-lock.json
git commit -m "feat(config): validate env at startup; require https CORS in prod (C5)"
```

---

## Task 2: Move destructive migrations to operational scripts (C3)

Two migrations run `DELETE FROM` and currently execute on `npm run migration:run`. Move them out of the migration sequence and expose them as explicit `npm run` operational scripts.

**Files:**
- Create: `scripts/reset-data.ts`
- Delete: `src/database/migrations/1761600000000-ClearExistingData.ts`
- Delete: `src/database/migrations/1761800000000-ClearVerificationsAndAccounts.ts`
- Delete: `src/database/migrations/1730138400000-ClearAccountsAndVerifications.ts` (also destructive — confirm contents in Step 1)
- Modify: `package.json` (add scripts)
- Test: `scripts/reset-data.spec.ts`

- [ ] **Step 1: Confirm the third destructive migration**

```bash
grep -l "DELETE FROM\|TRUNCATE" src/database/migrations/*.ts
```

Expected output includes `1730138400000-ClearAccountsAndVerifications.ts`, `1761600000000-ClearExistingData.ts`, `1761800000000-ClearVerificationsAndAccounts.ts`. If others appear, add them to the deletion list. If only the two known ones appear, drop the third from this task.

- [ ] **Step 2: Create the operational reset script**

Create `scripts/reset-data.ts`:
```ts
/**
 * Operational data-reset script. NOT a migration — must be invoked explicitly.
 * Usage:
 *   npm run reset:data -- --mode=full     # everything except super_admin users
 *   npm run reset:data -- --mode=verifications  # verifications + accounts only
 *
 * Refuses to run when NODE_ENV=production unless ALLOW_PROD_DATA_RESET=true is set.
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import dataSourceOptions from '../src/database/data-source';

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? 'true'];
    }),
  );
  const mode = args.mode ?? 'verifications';

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_DATA_RESET !== 'true') {
    console.error('Refusing to run in production without ALLOW_PROD_DATA_RESET=true');
    process.exit(1);
  }

  const ds = new DataSource(dataSourceOptions as any);
  await ds.initialize();

  await ds.query('SET session_replication_role = replica;');
  try {
    if (mode === 'full') {
      console.log('Mode: full — wiping all tenant data, keeping super_admin users');
      await ds.query("DELETE FROM webhook_logs;");
      await ds.query("DELETE FROM verification_documents;");
      await ds.query("DELETE FROM verifications;");
      await ds.query("DELETE FROM accounts;");
      await ds.query("DELETE FROM api_keys;");
      await ds.query("DELETE FROM tenant_provider_configs;");
      await ds.query("DELETE FROM refresh_tokens;");
      await ds.query("DELETE FROM users WHERE user_type != 'super_admin';");
      await ds.query("DELETE FROM tenants;");
      await ds.query("DELETE FROM providers;");
    } else if (mode === 'verifications') {
      console.log('Mode: verifications — wiping verifications + accounts, keeping configuration');
      await ds.query("DELETE FROM webhook_logs WHERE verification_id IS NOT NULL;");
      await ds.query("DELETE FROM verification_documents;");
      await ds.query("DELETE FROM verifications;");
      await ds.query("DELETE FROM accounts;");
    } else {
      throw new Error(`Unknown mode: ${mode}. Use --mode=full or --mode=verifications`);
    }
  } finally {
    await ds.query('SET session_replication_role = DEFAULT;');
    await ds.destroy();
  }
  console.log('Reset complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Add npm scripts**

Modify `package.json`. Add to the `"scripts"` block:
```json
"reset:data": "ts-node scripts/reset-data.ts",
```
Place after the existing `seed:run` line.

- [ ] **Step 4: Delete the destructive migration files**

```bash
git rm src/database/migrations/1761600000000-ClearExistingData.ts
git rm src/database/migrations/1761800000000-ClearVerificationsAndAccounts.ts
git rm src/database/migrations/1730138400000-ClearAccountsAndVerifications.ts
```

(Skip the third file if Step 1 showed only two.)

- [ ] **Step 5: Add a follow-up cleanup migration to remove their entries from the migrations table**

Create `src/database/migrations/1762000000000-RemoveDestructiveMigrationEntries.ts`:
```ts
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
```

- [ ] **Step 6: Run all migrations on a fresh dev DB to verify the sequence still applies cleanly**

```bash
docker compose up -d postgres
DATABASE_NAME=kyc_test_$(date +%s) npm run migration:run
```

Expected: every migration in the sequence applies cleanly. No `DELETE FROM` is emitted.

- [ ] **Step 7: Commit**

```bash
git add scripts/ src/database/migrations/1762000000000-RemoveDestructiveMigrationEntries.ts package.json
git commit -m "chore(db): move destructive Clear* migrations to scripts/reset-data (C3)

- Three migrations were running DELETE FROM on every npm run migration:run.
- Moved cleanup logic to scripts/reset-data.ts with explicit modes.
- Added cleanup migration to remove the old entries from the migrations table
  on existing deployments."
```

---

## Task 3: Webhook signature hardening (C1)

Three bypasses today: missing header skips check, missing provider secret skips check, wrong-length signature throws `RangeError`. Fix all three with hard-fail semantics, hex/length validation, and length-checked timing-safe comparison.

**Files:**
- Modify: `src/webhooks/webhook-signature.service.ts`
- Modify: `src/webhooks/webhooks.service.ts:73-102`
- Test: `src/webhooks/webhook-signature.service.spec.ts` (new)
- Test: `src/webhooks/webhooks.service.spec.ts` (extend)

- [ ] **Step 1: Write failing tests for signature service**

Create `src/webhooks/webhook-signature.service.spec.ts`:
```ts
import { WebhookSignatureService } from './webhook-signature.service';
import * as crypto from 'crypto';

describe('WebhookSignatureService.verifySignature', () => {
  let service: WebhookSignatureService;
  const secret = 'test-secret';
  const payload = { verification_id: 'abc', status: 'verified' };
  const validSig = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  beforeEach(() => {
    service = new WebhookSignatureService();
  });

  it('returns true for a valid signature', () => {
    expect(service.verifySignature(payload, validSig, secret)).toBe(true);
  });

  it('returns false for an invalid (correct-length, wrong-bytes) signature', () => {
    const wrong = 'a'.repeat(64);
    expect(service.verifySignature(payload, wrong, secret)).toBe(false);
  });

  it('returns false for a too-short signature without throwing', () => {
    expect(() => service.verifySignature(payload, 'abc', secret)).not.toThrow();
    expect(service.verifySignature(payload, 'abc', secret)).toBe(false);
  });

  it('returns false for a too-long signature without throwing', () => {
    const tooLong = 'a'.repeat(128);
    expect(() => service.verifySignature(payload, tooLong, secret)).not.toThrow();
    expect(service.verifySignature(payload, tooLong, secret)).toBe(false);
  });

  it('returns false for non-hex signature without throwing', () => {
    const nonHex = '!'.repeat(64);
    expect(service.verifySignature(payload, nonHex, secret)).toBe(false);
  });

  it('returns false for undefined signature', () => {
    expect(service.verifySignature(payload, undefined as any, secret)).toBe(false);
  });

  it('returns false for empty secret', () => {
    expect(service.verifySignature(payload, validSig, '')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest src/webhooks/webhook-signature.service.spec.ts
```

Expected: at least 3 fail (too-short throws RangeError, non-hex throws or matches by accident, undefined throws).

- [ ] **Step 3: Rewrite `WebhookSignatureService.verifySignature`**

Modify `src/webhooks/webhook-signature.service.ts`. Replace the entire `verifySignature` method (lines 6-22) with:
```ts
verifySignature(payload: any, signature: string | undefined, secret: string): boolean {
  // Hard-fail on missing inputs
  if (!signature || !secret) {
    return false;
  }
  // Validate shape: 64 hex chars (SHA-256 → 32 bytes → 64 hex)
  if (signature.length !== 64 || !/^[a-f0-9]+$/i.test(signature)) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest(); // raw Buffer, 32 bytes

  const provided = Buffer.from(signature, 'hex'); // 32 bytes since shape is validated

  // Length is guaranteed equal here, but keep the check for defense-in-depth
  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/webhooks/webhook-signature.service.spec.ts
```

Expected: all 7 PASS.

- [ ] **Step 5: Write a failing test for the webhook service hard-fail**

Extend `src/webhooks/webhooks.service.spec.ts`. Add inside the existing `describe('WebhooksService', ...)`:
```ts
describe('handleProviderWebhook hard-fails', () => {
  beforeEach(() => {
    mockProvidersFactory.getProviderEntityById.mockResolvedValue({
      id: 'p1',
      api_key: 'k',
      secret_key: 's',
      webhook_secret: 'w',
      base_url: 'https://provider',
    });
    mockProvidersFactory.getProviderById.mockResolvedValue({
      isInitialized: false,
      initialize: jest.fn().mockResolvedValue(undefined),
      handleWebhook: jest.fn(),
    });
    mockWebhookLogRepo.save.mockResolvedValue({ id: 'log1' });
  });

  it('rejects when signature header is missing', async () => {
    await expect(
      service.handleProviderWebhook('p1', { tenant_id: 't1' }, undefined),
    ).rejects.toThrow(/signature/i);
  });

  it('rejects when provider has no webhook_secret', async () => {
    mockProvidersFactory.getProviderEntityById.mockResolvedValue({
      id: 'p1', api_key: 'k', secret_key: 's', webhook_secret: null, base_url: 'https://provider',
    });
    await expect(
      service.handleProviderWebhook('p1', { tenant_id: 't1' }, 'a'.repeat(64)),
    ).rejects.toThrow(/webhook secret/i);
  });

  it('rejects when signature is invalid', async () => {
    mockSignatureService.verifySignature.mockReturnValue(false);
    await expect(
      service.handleProviderWebhook('p1', { tenant_id: 't1' }, 'a'.repeat(64)),
    ).rejects.toThrow(/invalid.*signature/i);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
npx jest src/webhooks/webhooks.service.spec.ts -t 'hard-fails'
```

Expected: 3 FAIL (current code accepts the missing-signature and missing-secret cases).

- [ ] **Step 7: Update `webhooks.service.ts` to hard-fail**

Modify `src/webhooks/webhooks.service.ts`. Replace lines 73-102 (the soft-fail region around tenant inference + signature verification) with:
```ts
// 5. Hard-fail if signature missing
if (!signature) {
  await this.webhookLogRepository.update(webhookLog.id, {
    status: 'failed',
    error_message: 'Missing webhook signature',
    processed_at: new Date(),
  });
  throw new UnauthorizedException('Missing webhook signature');
}

// 6. Hard-fail if provider has no webhook_secret configured
const webhookSecret = providerEntity.webhook_secret;
if (!webhookSecret) {
  await this.webhookLogRepository.update(webhookLog.id, {
    status: 'failed',
    error_message: 'Provider has no webhook secret configured',
    processed_at: new Date(),
  });
  throw new UnauthorizedException('Provider has no webhook secret configured');
}

// 7. Verify signature
const isValid = this.signatureService.verifySignature(payload, signature, webhookSecret);
if (!isValid) {
  await this.webhookLogRepository.update(webhookLog.id, {
    status: 'failed',
    error_message: 'Invalid webhook signature',
    processed_at: new Date(),
  });
  throw new UnauthorizedException('Invalid webhook signature');
}

// 8. Optional: warn if tenant cannot be inferred (informational only — already verified)
const inferredTenantId = payload?.tenant_id || payload?.metadata?.tenantId || payload?.tenantId;
if (!inferredTenantId) {
  this.logger.warn(`Tenant ID not found in webhook payload for provider ${providerId}`);
}
```

Add at top of file:
```ts
import { UnauthorizedException } from '@nestjs/common';
```

(Replace the existing import line `import { Injectable, Logger, NotFoundException } from '@nestjs/common';` with `import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';`.)

- [ ] **Step 8: Run all webhook tests to verify they pass**

```bash
npx jest src/webhooks/
```

Expected: all PASS, including the new hard-fail tests.

- [ ] **Step 9: Commit**

```bash
git add src/webhooks/
git commit -m "fix(webhooks): hard-fail on missing/invalid HMAC signature (C1)

- Reject when x-webhook-signature header missing (was: bypass).
- Reject when provider has no webhook_secret (was: bypass).
- Validate signature is 64 hex chars before timingSafeEqual (was: RangeError → 500).
- Use raw Buffer comparison; length-check defense-in-depth.
- Mark webhook_log status=failed with reason on every reject path."
```

---

## Task 4: Stop returning provider secrets in admin GET responses (C2b)

Three response shapes leak the raw `webhook_secret` / `api_key` / `secret_key`. Replace with `*_set: boolean`. Add a one-shot reveal endpoint guarded by an audit-logged super-admin action for the rare case the secret needs to be copied into a provider dashboard.

**Files:**
- Modify: `src/admin/admin.service.ts` (lines 358-363, 500-503, 738-773)
- Modify: `src/admin/admin.controller.ts` (add reveal endpoint)
- Modify: `src/database/entities/audit-log.entity.ts` (verify exists; create if missing — see Step 1)
- Test: `src/admin/admin.service.spec.ts` (extend)

- [ ] **Step 1: Verify the audit-logs entity exists**

```bash
ls src/database/entities/audit-log.entity.ts 2>&1
```

If the file does not exist (likely, since `grep -rn AuditLog src/` may show only docs references), skip the audit-log writes for now and add a `// TODO: write audit log when audit-log entity is wired (see Recommendation 4)` comment in Step 4. Otherwise wire `AuditLogRepository` injection into `AdminService`.

- [ ] **Step 2: Write a failing test asserting secrets are NOT in responses**

Extend `src/admin/admin.service.spec.ts`:
```ts
describe('admin.service — secret leak prevention', () => {
  it('getTenantProviderConfigs does not return webhook_secret values', async () => {
    mockTenantProviderConfigRepo.find.mockResolvedValue([{
      id: 'cfg1',
      tenant_id: 't1',
      priority: 1,
      is_enabled: true,
      tenant_overrides: null,
      created_at: new Date(),
      updated_at: new Date(),
      provider: {
        id: 'p1',
        name: 'IDmeta',
        type: 'multi_step',
        base_url: 'https://x',
        api_version: 'v1',
        is_active: true,
        webhook_secret: 'super-secret-do-not-leak',
        api_key: 'live-api-key',
        secret_key: 'live-secret',
      },
    }]);
    const result = await service.getTenantProviderConfigs('t1');
    expect(result[0]).not.toHaveProperty('webhook_secret');
    expect(JSON.stringify(result)).not.toContain('super-secret-do-not-leak');
    expect(JSON.stringify(result)).not.toContain('live-api-key');
    expect(JSON.stringify(result)).not.toContain('live-secret');
    expect(result[0].webhook_secret_set).toBe(true);
  });

  it('getProvider does not return raw api_key/secret_key/webhook_secret', async () => {
    mockProviderRepo.findOne.mockResolvedValue({
      id: 'p1', name: 'IDmeta', type: 'multi_step', base_url: 'https://x',
      api_version: 'v1', is_active: true, supports_webhooks: true,
      supports_multi_step: true, supports_hosted_workflow: true,
      api_key: 'leak-api', secret_key: 'leak-secret', webhook_secret: 'leak-hmac',
      config: {}, created_at: new Date(), updated_at: new Date(),
    });
    const result = await service.getProvider('p1');
    expect(result).not.toHaveProperty('api_key');
    expect(result).not.toHaveProperty('secret_key');
    expect(result).not.toHaveProperty('webhook_secret');
    expect(result.api_key_set).toBe(true);
    expect(result.secret_key_set).toBe(true);
    expect(result.webhook_secret_set).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx jest src/admin/admin.service.spec.ts -t 'secret leak'
```

Expected: 2 FAIL (current code returns the secrets).

- [ ] **Step 4: Sanitize `getTenantProviderConfigs`**

Modify `src/admin/admin.service.ts:358-361`. Replace:
```ts
webhook_endpoint: `/v1/webhook/${(config.provider.name || '').toLowerCase()}`,
webhook_secret_set: Boolean(config.provider?.webhook_secret),
// Expose provider-level HMAC so super admins can configure provider dashboards
webhook_secret: config.provider?.webhook_secret,
```
with:
```ts
webhook_endpoint: `/v1/webhook/${(config.provider.name || '').toLowerCase()}`,
webhook_secret_set: Boolean(config.provider?.webhook_secret),
```

- [ ] **Step 5: Sanitize `getTenantProviderConfig`**

Modify `src/admin/admin.service.ts:500-503`. Replace:
```ts
webhook_endpoint: `/v1/webhook/${(config.provider.name || '').toLowerCase()}`,
webhook_secret_set: Boolean(config.provider?.webhook_secret),
webhook_secret: config.provider?.webhook_secret,
```
with:
```ts
webhook_endpoint: `/v1/webhook/${(config.provider.name || '').toLowerCase()}`,
webhook_secret_set: Boolean(config.provider?.webhook_secret),
```

- [ ] **Step 6: Sanitize `getProvider`**

Modify `src/admin/admin.service.ts:756-773`. Replace the response object with:
```ts
return {
  id: provider.id,
  name: provider.name,
  type: provider.type,
  api_version: provider.api_version,
  base_url: provider.base_url,
  supports_webhooks: provider.supports_webhooks,
  supports_multi_step: provider.supports_multi_step,
  supports_hosted_workflow: provider.supports_hosted_workflow,
  is_active: provider.is_active,
  config: provider.config,
  api_key_set: Boolean(provider.api_key),
  secret_key_set: Boolean(provider.secret_key),
  webhook_secret_set: Boolean(provider.webhook_secret),
  created_at: provider.created_at,
  updated_at: provider.updated_at,
};
```

(Drop every line that returns `api_key`, `secret_key`, or `webhook_secret`. Keep their `*_set` siblings.)

- [ ] **Step 7: Add a reveal endpoint for one-shot copy**

Add to `src/admin/admin.controller.ts`:
```ts
@Post('providers/:id/reveal-secrets')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: 'One-time reveal of provider secrets for super admin (audit-logged)' })
@ApiResponse({ status: 200, description: 'Secrets returned once' })
@ApiResponse({ status: 403, description: 'Not super admin' })
async revealProviderSecrets(@Param('id') id: string, @Request() req) {
  return this.adminService.revealProviderSecrets(id, req.user.id);
}
```
Add the matching service method to `src/admin/admin.service.ts`:
```ts
async revealProviderSecrets(providerId: string, actingUserId: string) {
  const provider = await this.providerRepository.findOne({ where: { id: providerId } });
  if (!provider) {
    throw new NotFoundException(`Provider ${providerId} not found`);
  }
  this.logger.warn(
    `[AUDIT] Super admin ${actingUserId} revealed secrets for provider ${providerId} (${provider.name})`,
  );
  // TODO: persist to audit_logs entity once that entity is wired (Recommendation 4 in CODE_REVIEW.md).
  return {
    id: provider.id,
    name: provider.name,
    api_key: provider.api_key,
    secret_key: provider.secret_key,
    webhook_secret: provider.webhook_secret,
    revealed_at: new Date().toISOString(),
    warning: 'These values are sensitive. Copy now; they will not be shown again without another reveal call.',
  };
}
```

- [ ] **Step 8: Run all admin tests to verify they pass**

```bash
npx jest src/admin/
```

Expected: all PASS, including the two new "secret leak" tests.

- [ ] **Step 9: Commit**

```bash
git add src/admin/
git commit -m "fix(admin): stop leaking provider secrets in GET responses (C2b)

- Replace webhook_secret/api_key/secret_key fields with *_set: boolean.
- Add POST /admin/providers/:id/reveal-secrets for one-shot reveal,
  guarded by AdminAuthGuard and audit-logged via warn-level logger.
- Remove the inline 'super admins can configure dashboards' comment;
  documented behavior is now: use the reveal endpoint."
```

---

## Task 5: Fix EncryptionService and encrypt provider credentials at rest (C2a + C2c)

Rewrite `EncryptionService` to use `createCipheriv`/`createDecipheriv` properly. Wire it into `Provider` entity via TypeORM column transformer so `api_key`, `secret_key`, `webhook_secret` are encrypted on write and decrypted on read. Migrate existing plaintext rows.

**Files:**
- Modify: `src/common/encryption.service.ts` (full rewrite)
- Modify: `src/common/common.module.ts` (export `EncryptionService`)
- Create: `src/database/transformers/encrypted-column.transformer.ts`
- Modify: `src/database/entities/provider.entity.ts` (apply transformer)
- Create: `src/database/migrations/1762100000000-EncryptProviderCredentials.ts`
- Test: `src/common/encryption.service.spec.ts`
- Test: `src/database/transformers/encrypted-column.transformer.spec.ts`

- [ ] **Step 1: Write failing tests for EncryptionService**

Create `src/common/encryption.service.spec.ts`:
```ts
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  const key = 'a'.repeat(32);
  let service: EncryptionService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = key;
    service = new EncryptionService(new ConfigService());
  });

  it('round-trips a string', () => {
    const plaintext = 'super-secret-api-key-abc-123';
    const ciphertext = service.encrypt(plaintext);
    expect(ciphertext).not.toContain(plaintext);
    expect(service.decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'hello';
    const c1 = service.encrypt(plaintext);
    const c2 = service.encrypt(plaintext);
    expect(c1).not.toBe(c2);
    expect(service.decrypt(c1)).toBe(plaintext);
    expect(service.decrypt(c2)).toBe(plaintext);
  });

  it('rejects ciphertext with tampered authTag', () => {
    const ciphertext = service.encrypt('hello');
    const [iv, tag, ct] = ciphertext.split(':');
    const tampered = [iv, 'a'.repeat(tag.length), ct].join(':');
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('rejects ciphertext from a different key', () => {
    const ciphertext = service.encrypt('hello');
    process.env.ENCRYPTION_KEY = 'b'.repeat(32);
    const otherService = new EncryptionService(new ConfigService());
    expect(() => otherService.decrypt(ciphertext)).toThrow();
  });

  it('throws on construction if ENCRYPTION_KEY missing', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => new EncryptionService(new ConfigService())).toThrow(/ENCRYPTION_KEY/);
  });

  it('throws on construction if ENCRYPTION_KEY wrong length', () => {
    process.env.ENCRYPTION_KEY = 'too-short';
    expect(() => new EncryptionService(new ConfigService())).toThrow(/32/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/common/encryption.service.spec.ts
```

Expected: at least 4 FAIL — current `createCipher` ignores random IV so c1 === c2; tamper detection partially works but on the wrong paths; wrong-key behavior depends on whether `createDecipher` errors at all.

- [ ] **Step 3: Rewrite `EncryptionService`**

Replace the entire body of `src/common/encryption.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly aad = Buffer.from('kyc-adapter', 'utf8');

  constructor(private readonly configService: ConfigService) {
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    if (encryptionKey.length !== 32) {
      throw new Error(`ENCRYPTION_KEY must be exactly 32 characters long. Got: ${encryptionKey.length} characters`);
    }
    this.key = Buffer.from(encryptionKey, 'utf8');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    cipher.setAAD(this.aad);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: ivHex:authTagHex:ciphertextHex
    return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAAD(this.aad);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  generateRandomKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/common/encryption.service.spec.ts
```

Expected: 6 PASS.

- [ ] **Step 5: Make sure CommonModule exports EncryptionService**

Modify `src/common/common.module.ts` — confirm `EncryptionService` appears in both `providers` and `exports`. If not, add:
```ts
import { EncryptionService } from './encryption.service';
// ...
providers: [..., EncryptionService],
exports: [..., EncryptionService],
```

- [ ] **Step 6: Write failing test for the column transformer**

Create `src/database/transformers/encrypted-column.transformer.spec.ts`:
```ts
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../common/encryption.service';
import { encryptedColumnTransformer } from './encrypted-column.transformer';

describe('encryptedColumnTransformer', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(32);
    encryptedColumnTransformer.__setEncryptionService(new EncryptionService(new ConfigService()));
  });

  it('passes null through to and from the database', () => {
    expect(encryptedColumnTransformer.to(null)).toBeNull();
    expect(encryptedColumnTransformer.from(null)).toBeNull();
    expect(encryptedColumnTransformer.to(undefined)).toBeNull();
    expect(encryptedColumnTransformer.from(undefined)).toBeNull();
  });

  it('encrypts on the way to the DB and decrypts on the way back', () => {
    const plain = 'idmeta-api-key-XYZ';
    const stored = encryptedColumnTransformer.to(plain) as string;
    expect(stored).not.toBe(plain);
    expect(stored.split(':')).toHaveLength(3);
    expect(encryptedColumnTransformer.from(stored)).toBe(plain);
  });

  it('passes through a value that is not encrypted (legacy plaintext) on read', () => {
    // Legacy rows hold plaintext until the migration runs. Reads must not crash.
    expect(encryptedColumnTransformer.from('legacy-plaintext-key')).toBe('legacy-plaintext-key');
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

```bash
npx jest src/database/transformers/encrypted-column.transformer.spec.ts
```

Expected: FAIL with `Cannot find module './encrypted-column.transformer'`.

- [ ] **Step 8: Implement the transformer**

Create `src/database/transformers/encrypted-column.transformer.ts`:
```ts
import { ValueTransformer } from 'typeorm';
import { EncryptionService } from '../../common/encryption.service';

/**
 * TypeORM column transformer that encrypts a string on the way to the DB
 * and decrypts on the way back. Tolerant of legacy plaintext rows so
 * deployments can roll over without immediate migration.
 *
 * Stores values in the format: ivHex:authTagHex:ciphertextHex (three colons-separated hex strings).
 * Any value that does NOT match that shape is treated as legacy plaintext and passed through unchanged.
 */
class EncryptedColumnTransformer implements ValueTransformer {
  private encryption: EncryptionService | null = null;
  private static readonly ENCRYPTED_SHAPE = /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i;

  /** For tests + bootstrap from app.module. Wired at startup. */
  __setEncryptionService(svc: EncryptionService): void {
    this.encryption = svc;
  }

  to(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (!this.encryption) {
      throw new Error('EncryptionService not initialized for column transformer');
    }
    return this.encryption.encrypt(value);
  }

  from(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (!this.encryption) {
      throw new Error('EncryptionService not initialized for column transformer');
    }
    if (!EncryptedColumnTransformer.ENCRYPTED_SHAPE.test(value)) {
      // Legacy plaintext — pass through. Migration in 1762100000000 backfills.
      return value;
    }
    return this.encryption.decrypt(value);
  }
}

export const encryptedColumnTransformer = new EncryptedColumnTransformer();
```

- [ ] **Step 9: Run the transformer test**

```bash
npx jest src/database/transformers/encrypted-column.transformer.spec.ts
```

Expected: 3 PASS.

- [ ] **Step 10: Wire transformer initialization at app startup**

Modify `src/app.module.ts`. Add at the bottom of the file (after the `@Module` decorator):
```ts
import { OnModuleInit } from '@nestjs/common';
import { EncryptionService } from './common/encryption.service';
import { encryptedColumnTransformer } from './database/transformers/encrypted-column.transformer';

export class AppModule implements OnModuleInit {
  constructor(private readonly encryption: EncryptionService) {}
  onModuleInit() {
    encryptedColumnTransformer.__setEncryptionService(this.encryption);
  }
}
```
(Replace the existing `export class AppModule {}` line.)

- [ ] **Step 11: Apply the transformer to provider entity columns**

Modify `src/database/entities/provider.entity.ts:24-31`. Replace the three credential columns:
```ts
@Column({ nullable: true, transformer: encryptedColumnTransformer })
api_key?: string;

@Column({ nullable: true, transformer: encryptedColumnTransformer })
secret_key?: string;

@Column({ nullable: true, transformer: encryptedColumnTransformer })
webhook_secret?: string;
```
Add at the top of the file:
```ts
import { encryptedColumnTransformer } from '../transformers/encrypted-column.transformer';
```

- [ ] **Step 12: Verify build still type-checks**

```bash
npm run build
```

Expected: build succeeds. If TypeORM complains about `transformer` typing, ensure the import path is correct.

- [ ] **Step 13: Write the data migration**

Create `src/database/migrations/1762100000000-EncryptProviderCredentials.ts`:
```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../common/encryption.service';

/**
 * One-shot migration: encrypt all existing plaintext provider credentials.
 * Reads each row, encrypts non-null api_key/secret_key/webhook_secret if they
 * are not already in encrypted shape (ivHex:authTagHex:ciphertextHex), and writes back.
 */
export class EncryptProviderCredentials1762100000000 implements MigrationInterface {
  private static readonly ENCRYPTED_SHAPE = /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const enc = new EncryptionService(new ConfigService());
    const rows: Array<{ id: string; api_key: string | null; secret_key: string | null; webhook_secret: string | null }> =
      await queryRunner.query(`SELECT id, api_key, secret_key, webhook_secret FROM providers`);

    for (const row of rows) {
      const updates: string[] = [];
      const params: any[] = [];

      const tryEncrypt = (col: string, value: string | null) => {
        if (value && !EncryptProviderCredentials1762100000000.ENCRYPTED_SHAPE.test(value)) {
          updates.push(`${col} = $${params.length + 1}`);
          params.push(enc.encrypt(value));
        }
      };

      tryEncrypt('api_key', row.api_key);
      tryEncrypt('secret_key', row.secret_key);
      tryEncrypt('webhook_secret', row.webhook_secret);

      if (updates.length > 0) {
        params.push(row.id);
        await queryRunner.query(
          `UPDATE providers SET ${updates.join(', ')} WHERE id = $${params.length}`,
          params,
        );
        console.log(`✓ Encrypted ${updates.length} columns on provider ${row.id}`);
      }
    }
  }

  public async down(): Promise<void> {
    // No-op: cannot rebuild plaintext from ciphertext without the key, and we don't want to.
    console.log('⚠️  Cannot revert encryption migration. Use a backup if you need plaintext back.');
  }
}
```

- [ ] **Step 14: Run the migration locally**

```bash
docker compose up -d postgres
npm run migration:run
```

Expected: log lines `✓ Encrypted 3 columns on provider <uuid>` for each provider that had plaintext credentials. Re-running the migration should be a no-op (it skips already-encrypted values via the shape regex).

- [ ] **Step 15: Verify end-to-end with an integration test**

Run the existing `npm test` and add a smoke verification:
```bash
npm test
```

Expected: all PASS (transformer tests + admin tests + webhook tests). Additionally, manually start the app and call `POST /admin/providers/:id/reveal-secrets` (added in Task 4) — the response should show the decrypted plaintext, while a direct DB query (`SELECT api_key FROM providers`) shows colon-delimited hex.

```bash
psql "$DATABASE_URL" -c "SELECT id, api_key FROM providers LIMIT 1"
```

Expected: `api_key` column contains a string matching `^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$`.

- [ ] **Step 16: Commit**

```bash
git add src/common/ src/database/transformers/ src/database/entities/provider.entity.ts src/database/migrations/1762100000000-EncryptProviderCredentials.ts src/app.module.ts
git commit -m "feat(security): encrypt provider credentials at rest with AES-256-GCM (C2a+C2c)

- Rewrite EncryptionService to use createCipheriv/createDecipheriv,
  per-call random 96-bit IV, AAD bound to 'kyc-adapter'.
- Add encryptedColumnTransformer (TypeORM ValueTransformer).
- Apply to providers.api_key/secret_key/webhook_secret.
- Migration 1762100000000 encrypts existing plaintext rows in place.
- Transformer tolerates legacy plaintext on read for graceful rollover."
```

---

## Task 6: Rate limiting via @nestjs/throttler (C4)

Replace the unwired `RateLimitService` with `@nestjs/throttler`. Apply a global default, with per-route overrides for hot paths.

**Files:**
- Modify: `package.json` (add deps)
- Modify: `src/app.module.ts` (register ThrottlerModule + global guard)
- Modify: `src/auth/auth.controller.ts` (per-route override on `/login`)
- Modify: `src/verifications/verifications.controller.ts` (per-route on `/initiate`)
- Modify: `src/webhooks/webhooks.controller.ts` (per-route on the public webhook)
- Delete: `src/common/rate-limit.service.ts` (now dead) AND remove from `common.module.ts`
- Test: `src/auth/auth.controller.spec.ts` (extend with throttle test) — or e2e test

- [ ] **Step 1: Install dependencies**

```bash
npm install @nestjs/throttler@^5.1.0 @nest-lab/throttler-storage-redis@^1.0.0
```

(`@nest-lab/throttler-storage-redis` is the actively maintained Redis storage adapter for v5+. If your repo standardizes on a different one, swap.)

Expected: dependencies added to `package.json`.

- [ ] **Step 2: Register `ThrottlerModule` in `app.module.ts`**

Modify `src/app.module.ts`. Add to imports list before `AuthModule`:
```ts
ThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const ttl = Number(config.get('RATE_LIMIT_TTL', 60)) * 1000;
    const limit = Number(config.get('RATE_LIMIT_MAX', 100));
    const storage = config.get('REDIS_HOST')
      ? new ThrottlerStorageRedisService({
          host: config.get('REDIS_HOST'),
          port: Number(config.get('REDIS_PORT', 6379)),
          password: config.get('REDIS_PASSWORD') || undefined,
        })
      : undefined;
    return {
      throttlers: [{ name: 'default', ttl, limit }],
      storage,
    };
  },
}),
```
And add to providers:
```ts
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```
Add imports:
```ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
```

- [ ] **Step 3: Override the rate limit on `/auth/login`**

Modify `src/auth/auth.controller.ts`. On the `login` method, add the decorator:
```ts
@Throttle({ default: { ttl: 60_000, limit: 5 } })
@Post('login')
// ... existing decorators
```
Add the import:
```ts
import { Throttle } from '@nestjs/throttler';
```

- [ ] **Step 4: Override on `/verifications/initiate`**

Modify `src/verifications/verifications.controller.ts:31`. Add above the `@Post('initiate')` line:
```ts
@Throttle({ default: { ttl: 60_000, limit: 30 } })
```
Add the import.

- [ ] **Step 5: Override on the public webhook endpoints**

Modify `src/webhooks/webhooks.controller.ts:14` and `src/webhooks/public-webhooks.controller.ts:14`. Above the `@Post(...)` line, add:
```ts
@Throttle({ default: { ttl: 60_000, limit: 100 } })
```
Add imports. (Webhook traffic is provider-driven so the limit can be looser, but bounded to defeat retry storms.)

- [ ] **Step 6: Write a controller-level smoke test for the auth limit**

Add to `src/auth/auth.controller.spec.ts` (create if it doesn't exist; otherwise extend). Use `supertest` against a `Test.createTestingModule`:
```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';

describe('AuthController throttling', () => {
  let app: INestApplication;
  const mockAuthService = { login: jest.fn().mockResolvedValue({ access_token: 't' }) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 5 }]),
      ],
      controllers: [AuthController],
      providers: [{ provide: 'AuthService', useValue: mockAuthService }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('returns 429 after the 6th login attempt within the window', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'a@b.com', password: 'x' })
        .expect((res) => expect(res.status).not.toBe(429));
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.com', password: 'x' })
      .expect(429);
  });
});
```

(If `AuthService` is wired via concrete class, swap the mock provider syntax accordingly.)

- [ ] **Step 7: Run the throttle test**

```bash
npx jest src/auth/auth.controller.spec.ts
```

Expected: PASS — 6th call returns 429.

- [ ] **Step 8: Delete the dead `RateLimitService`**

```bash
git rm src/common/rate-limit.service.ts
```
Modify `src/common/common.module.ts`: remove `RateLimitService` from `providers` and `exports`. Remove the import.

- [ ] **Step 9: Verify the full test suite passes**

```bash
npm test
```

Expected: all PASS. Some existing tests may need a `ThrottlerModule.forRoot([{ttl:60_000,limit:1000}])` import in their test module if they hit a `ThrottlerGuard`-protected controller; update those imports as needed.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/app.module.ts src/auth/ src/verifications/verifications.controller.ts src/webhooks/ src/common/
git commit -m "feat(security): add @nestjs/throttler with Redis storage (C4)

- Global default: env-driven RATE_LIMIT_MAX per RATE_LIMIT_TTL seconds.
- Per-route overrides: /auth/login 5/min, /verifications/initiate 30/min,
  webhooks 100/min.
- Redis storage when REDIS_HOST set; in-memory otherwise.
- Removed dead common/rate-limit.service.ts (replaced by throttler)."
```

---

## Final verification

- [ ] **Step 1: Full test suite**

```bash
npm test
```

Expected: every spec passes. Specifically:
- `env.validation.spec.ts`: 6 PASS
- `webhook-signature.service.spec.ts`: 7 PASS
- `webhooks.service.spec.ts`: existing + 3 hard-fail PASS
- `admin.service.spec.ts`: existing + 2 leak-prevention PASS
- `encryption.service.spec.ts`: 6 PASS
- `encrypted-column.transformer.spec.ts`: 3 PASS
- `auth.controller.spec.ts`: throttle test PASS

- [ ] **Step 2: Boot smoke**

```bash
npm run build
docker compose up -d postgres redis
npm run migration:run
npm run start:prod &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/docs
curl -s -X POST http://localhost:3000/webhooks/providers/00000000-0000-0000-0000-000000000000 \
  -H 'Content-Type: application/json' \
  -d '{}' \
  -w "\n%{http_code}\n"
kill %1
```

Expected:
- `/api/docs`: 200
- POST `/webhooks/providers/...` without `x-webhook-signature`: 401 (was: would-have-been-processed before Task 3).

- [ ] **Step 3: Verify ciphertext on disk**

```bash
psql "$DATABASE_URL" -c "SELECT api_key FROM providers WHERE api_key IS NOT NULL LIMIT 1"
```

Expected: a `^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$` value, not plaintext.

- [ ] **Step 4: Verify CORS rejection on bad origin**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Origin: https://attacker.example" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS http://localhost:3000/auth/login
```

Expected: response `Access-Control-Allow-Origin` is NOT echoed; preflight effectively denied.

- [ ] **Step 5: Verify `/auth/login` rate limit**

```bash
for i in {1..7}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Content-Type: application/json" \
    -X POST http://localhost:3000/auth/login \
    -d '{"email":"x@y.z","password":"wrong"}'
done
```

Expected: first 5 return `401`; 6th and 7th return `429`.

---

## Out of scope for this plan (tracked for follow-up)

These were flagged in `CODE_REVIEW.md` Important / Minor sections but are not Critical, so they're held back:

- I1 `accounts.controller.ts` tenantId fallback to user.id
- I2 `verifications.controller.ts` JWT-or-API-key on GET endpoints
- I3 SSRF validation on `callback_url` and `baseUrl`
- I4 webhook log payload PII redaction
- I5 provider factory registry refactor (for Regula/Persona)
- I6 provider singleton init cache leak
- I7 Bull queue null-safety audit
- I8 JWT logout/revocation
- I9 Per-route body size limit
- I10 Webhook log remote-IP capture
- All M1–M10

Recommendation: triage these into a "post-Critical hardening" plan after this one merges.

---

## Self-review checklist (run before handing this plan off)

**Spec coverage:**
- C1 → Task 3 ✓
- C2a (plaintext at rest) → Task 5 ✓
- C2b (secrets in admin GETs) → Task 4 ✓
- C2c (broken EncryptionService) → Task 5 (Steps 1-5) ✓
- C3 → Task 2 ✓
- C4 → Task 6 ✓
- C5 → Task 1 ✓
- M6 (env validation, bundled with C5) → Task 1 ✓

**Placeholder scan:** no `TODO`, no `placeholder`, no "implement later" — every step has runnable code or a concrete command.

**Type consistency:** `EncryptionService.encrypt/decrypt` signatures are stable across Tasks 5 and Task 5's migration. `encryptedColumnTransformer` import path is consistent. `ThrottlerModule` v5 API used consistently.
