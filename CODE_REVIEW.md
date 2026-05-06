# SERVER — Code Review (2026-05-04)

Production-readiness audit of the KYC Adapter NestJS backend. Scope: SERVER only (CLIENT and KYC-REGULA out of scope).

> **TL;DR** — The codebase has a working happy path, but security is the critical concern: webhook signature verification is bypassable, provider credentials are stored and returned in plaintext, and "rescue" code (encryption, rate limiting) is wired up but never used. Also: two destructive `DELETE FROM` migrations sit in the migration sequence and run automatically. Fix the Critical items before adding features or doing any further deployments.

---

## Severity legend

- **Critical** — security flaw, data-loss risk, or production-blocker. Fix before next deploy.
- **Important** — architecture/correctness issue. Fix before adding features on top.
- **Minor** — style, perf, future-proofing nit.

---

## Strengths (so the review is honest)

- Provider abstraction (`IKycProvider` + `ProvidersFactory`) is the right shape — adding Regula won't be hard architecturally, just wiring.
- Centralized provider credentials on the `providers` row (instead of duplicated per-tenant) is the correct call; `tenant_overrides` jsonb is a clean override seam.
- API key handling does the right things: SHA-256 hash for storage (`auth.service.ts:38, 180`), `key_prefix` for display, key shown once on creation, `last_used_at` updated atomically.
- Refresh token rotation on use with `revoked_at` (`auth.service.ts:165-167`) — solid.
- bcrypt for password hashing, cost 10 (`auth.service.ts:106`) — fine.
- Webhook log table (`webhook_logs`) records every inbound payload with status — good for debugging and replay; replay endpoint exists.
- Multi-tenant filtering is generally pushed down to service-layer queries (verifications, accounts) rather than relying solely on guards.
- Static file `/uploads` is served behind a fixed prefix (`main.ts:22-25`) — at least it's not directory-traversable.

---

## Critical (must fix)

### C1. Webhook signature verification is bypassable in three ways

The inbound webhook endpoint at `webhooks.controller.ts:14` and `public-webhooks.controller.ts:14` has **no guard**, which is correct for a provider-callable endpoint. But the signature check inside `webhooks.service.ts:87` is:

```ts
if (signature && webhookSecret) {
  const isValid = this.signatureService.verifySignature(payload, signature, webhookSecret);
  if (!isValid) { /* reject */ }
}
// otherwise: fall through, processed as if valid
```

**Bypass 1 — omit the signature header.** No `x-webhook-signature` header → `signature` is `undefined` → block skipped → webhook processed. `webhooks.service.ts:87`.

**Bypass 2 — provider has no webhook_secret.** If the `providers.webhook_secret` column is null (or the IDMeta entry was created before HMAC was set), check is skipped with only a `logger.warn`. `webhooks.service.ts:82-84`.

**Bypass 3 — wrong-length signature crashes the comparison.** `webhook-signature.service.ts:18-21`:

```ts
return crypto.timingSafeEqual(
  Buffer.from(signature),         // attacker-controlled length
  Buffer.from(expectedSignature)  // 64 hex chars = 64 bytes
);
```

`timingSafeEqual` throws `RangeError: Input buffers must have the same byte length` if buffers differ. Result: 500 (not 401), unhandled exception path. Also: `Buffer.from(string)` defaults to UTF-8, not hex — a non-hex signature produces a different byte length than expected, hitting the throw. Even a valid-hex signature of the wrong nibble count crashes.

**What an attacker can do.** POST to `/webhooks/providers/<known-provider-uuid>` (UUIDs are guessable from any frontend response that includes provider data) or `/v1/webhook/idmeta` (slug is public knowledge), omit `x-webhook-signature`, set `payload = {verification_id: <target>, status: 'verified'}`, and the webhook handler updates the verification row, broadcasts to the WS room, and forwards to the tenant's `callback_url`. Forged "verified" status for any verification with a known external_verification_id.

**Fix:**
1. **Hard-fail when signature or secret is missing** — drop the `if (signature && webhookSecret)` gate, replace with: if either is missing, return 401.
2. **Validate signature shape before comparing.** Require hex, length 64. Reject early with 401 on shape mismatch.
3. **Use `Buffer.from(signature, 'hex')`** when comparing, and length-check before `timingSafeEqual` to prevent RangeError.
4. **Add a circuit breaker** for malformed-payload retry storms.

---

### C2. Provider credentials at rest: plaintext, returned in API responses, dead encryption code

Already discussed in the conversation — three problems stacked:

**C2a. Plaintext storage.** `providers.api_key`, `providers.secret_key`, `providers.webhook_secret` are plain `@Column({nullable: true})` strings (`provider.entity.ts:24-31`). No transformer, no `@BeforeInsert` hook. Backups, replicas, and any DB user with SELECT see live IDMeta credentials.

**C2b. Secrets returned over the API.** Despite docs claiming "secret never returned":
- `admin.service.ts:361` (list tenant configs): `webhook_secret: config.provider?.webhook_secret`
- `admin.service.ts:503` (single tenant config): same
- `admin.service.ts:770-773` (admin GET provider): full `api_key`, `secret_key`, `webhook_secret` for super admin

These end up in browser dev-tools, reverse-proxy access logs, and any client-side caching layer.

**C2c. `EncryptionService` is dead AND broken.**
- `grep -r EncryptionService src/` — zero usages outside the file itself.
- `encryption.service.ts:24-35` uses `crypto.createCipher`, which is **deprecated** and derives a static IV from the key. The `iv = crypto.randomBytes(16)` is generated, prepended to the output, and never actually fed to the cipher. AES-GCM with a deterministic IV = catastrophic keystream reuse.
- Same bug in `decrypt`: `createDecipher(algo, key)` ignores the parsed IV.
- Need `crypto.createCipheriv(algo, key, iv)` / `crypto.createDecipheriv(algo, key, iv)`.

**Fix:**
1. **Stop returning secret values** from any GET. Replace with `{webhook_secret_set: boolean}`. If super admin needs to copy it once into a provider dashboard, use a dedicated `POST /admin/providers/:id/reveal-secrets` endpoint behind a re-auth challenge, with audit logging.
2. **Fix `EncryptionService`** before wiring it: `createCipheriv` / `createDecipheriv`, per-record random IV, AAD bound to row id.
3. **Add a TypeORM column transformer** that pipes secrets through encrypt/decrypt automatically, OR move secrets to GCP Secret Manager (you're already on GCP) and store only the secret reference in the DB.
4. **Rotate every secret currently in the DB** before fixing — any leaked credential should be considered burned.

---

### C3. Two destructive DELETE migrations live in the migration sequence

`src/database/migrations/1761600000000-ClearExistingData.ts` and `1761800000000-ClearVerificationsAndAccounts.ts` both run `DELETE FROM <table>` with `SET session_replication_role = replica` to bypass FK checks.

The first wipes verifications, accounts, api_keys, tenant_provider_configs, refresh_tokens, all non-super-admin users, tenants, and providers. The second wipes verifications, accounts, verification_documents, and verification-related webhook_logs.

These run automatically via `npm run migration:run`. Anyone who:
- Bootstraps a fresh box from main and runs migrations: fine.
- Restores a backup and re-runs migrations against a partially-migrated DB: data wiped.
- Resets the `migrations` tracking table for any reason: data wiped.
- Promotes a staging DB to prod via migration: data wiped.

Migrations should be schema-only and idempotent. Data cleanup belongs in seeds, fixtures, or operational scripts (`scripts/dev-reset.ts` etc.) that you have to run explicitly.

**Fix:**
1. Move both migrations into `scripts/` or `src/database/seeds/` and remove from the migration sequence.
2. If they need to remain for replay-once semantics, gate them behind an env var like `ALLOW_DESTRUCTIVE_MIGRATIONS=true` and `NODE_ENV !== 'production'`.
3. Document in the README that the cleanup is a manual operational step, not part of deploy.

---

### C4. No rate limiting in production

`common/rate-limit.service.ts` defines `checkRateLimit`, `checkApiKeyRateLimit`, `checkIpRateLimit`. `grep -r RateLimit src/` outside the service file: zero matches. Not wired to any controller, no guard, no interceptor, no middleware.

Endpoints exposed without any rate limit:
- `POST /auth/login` — credential stuffing target
- `POST /verifications/initiate` — IDMeta API key abuse vector (every initiate = paid IDMeta call)
- `POST /webhooks/providers/:id` and `POST /v1/webhook/:slug` — see C1; even after fixing signatures, an attacker can DOS this
- `POST /verifications/biometrics/face-match` and image-bearing endpoints — 10MB body × no limit = trivial memory DOS

**Fix:**
1. Wire `RateLimitService` (or `@nestjs/throttler`, which is more standard) into a global guard.
2. Per-endpoint overrides for hot paths (login: 5/min/IP; webhook: 100/min/provider+remoteIP; initiate: per-tenant quota tied to `tenants.quota_limit`).
3. Use Redis when present (`shared/redis.service.ts`) for distributed counters; fall back to in-memory only in dev.

---

### C5. CORS production fallback is `localhost`

`main.ts:42`:
```ts
origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
```

If the env var is missing in prod, `Access-Control-Allow-Origin` becomes `http://localhost:3000`. With `credentials: true`, this is a misconfiguration that silently fails most browsers but works for any local page. More dangerous: if anyone changes the fallback to `'*'` or `[req.headers.origin]` in a quick fix, the dual `credentials: true` + reflective origin enables CSRF.

**Fix:**
1. Throw on startup if `CORS_ORIGINS` is missing AND `NODE_ENV === 'production'`.
2. Default to `[]` (i.e., reject all cross-origin) — never localhost — when unset.
3. Validate each entry is `https://` in prod.

---

## Important (should fix before adding features)

### I1. `accounts.controller.ts` collapses tenantId fallback to user.id

Across `searchAccounts`, `findOne`, `update`, `remove`, `getAccountVerifications`, `getAccountDocuments`, `getAccountStats`:

```ts
const tenantId = req.user.tenantId || req.user.id;   // accounts.controller.ts:73,82,95,104,118,127,136
```

For super admin (no `tenantId`), this passes the user's UUID as `tenant_id` to the service, which queries `WHERE tenant_id = <super_admin_user_id>` — returns 0 rows. So super admins effectively can't read or modify any individual account through these endpoints. (`findAll` has correct logic at lines 40-62; the others don't.)

Also: `DELETE /accounts/:id` is gated by `JwtAuthGuard + TenantAuthGuard` only — any tenant_user can delete any account in their tenant. Should be tenant_admin or above.

**Fix:**
1. Replace the `||` fallback with explicit super-admin handling (pass null and let the service query without tenant filter, or require `tenantId` query param).
2. Add an admin-or-tenant-admin guard to mutating account endpoints.

---

### I2. `verifications.controller.ts` — inconsistent guards, dashboard can't read its own verifications

```ts
@Get(':id')           @UseGuards(ApiKeyAuthGuard)    // verifications.controller.ts:79-81
@Get(':id/status')    @UseGuards(ApiKeyAuthGuard)    // verifications.controller.ts:89-92
```

These are **API-key-only**. A logged-in dashboard user holding a JWT (no API key) cannot fetch their own verification or its status — the dashboard would have to mint an API key and store it client-side just to poll. Inconsistent with `POST /initiate` which accepts both via `JwtOrApiKeyGuard`.

**Fix:** change both to `@UseGuards(JwtOrApiKeyGuard)`. The frontend WS fallback ("polling `GET /verifications/:id/status`" per the docs) is broken today.

---

### I3. SSRF: `callback_url` and `baseUrl` overrides are not validated

- **`callback_url`** flows from client → `verifications.service.ts:94, 108` → IDMeta → `outgoing-webhook.service` POSTs to it on every status update. The service receives whatever URL the tenant set with no allowlist, no scheme check, no `127.0.0.1` / `169.254.169.254` block. A malicious tenant can point it at internal infra (RDS metadata endpoint, internal services, the adapter's own admin endpoints over a fake hostname).
- **Provider `baseUrl`** is configured by super admin — lower risk, but still: a misconfiguration or compromised admin account can point IDMeta calls at attacker-controlled URL, exfiltrating the live `api_key` Bearer token to a third party on the next `verification/create-verification` call.

**Fix:**
1. `callback_url`: validate URL, require `https://`, deny private IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`), deny `localhost`. Resolve DNS and re-check post-resolution to defeat DNS rebinding.
2. `baseUrl`: allowlist of approved provider domains per provider name. Audit log on change.

---

### I4. `webhooks.service.ts` — webhook log payload stores raw signature and PII

Line 40-46: full payload (including any PII the provider sends) and the signature are persisted to `webhook_logs`. Combined with C2 (no encryption at rest), this means a forged signature attempt or a successful verification posting government IDs both end up in the DB unencrypted, indexable, replayable.

`webhooks.service.ts:223-237` (`replayWebhook`) pipes the stored payload back through the same pipeline. If a payload was forged but accepted-as-processed (per C1), replaying it re-confirms the forgery.

**Fix:**
1. Redact PII fields from the logged payload before save (or store a SHA256 + redacted summary instead of the full payload).
2. Don't store the raw signature; store its hash for replay-detection only.
3. Replay should be guarded by a separate explicit flag (`replayable: false` by default).

---

### I5. Provider factory hardcoding blocks Regula/Persona

`providers.factory.ts:82-99`:
```ts
case 'multi_step':       return this.idmetaProvider;
case 'single_step':      return this.mockProvider;   // ← Regula slot, falls back to Mock
case 'async_webhook':    return this.mockProvider;   // ← Persona slot, falls back to Mock
case 'mock':             return this.mockProvider;
```

Adding Regula requires editing this method, the constructor injection list, and `providers.module.ts`. Three places to change for every new provider. Also, mapping is by `type` (`single_step`/`multi_step`/`async_webhook`), which collides — you can only have ONE `multi_step` provider in the system because a second provider of that type would resolve to the same instance via slug.

**Fix:**
1. Switch to a registry/strategy pattern: each provider self-registers under its own canonical name (`'idmeta'`, `'regula'`, `'persona'`), looked up by `provider.name` not `provider.type`.
2. Add a `BaseKycProvider` abstract class that each implementation extends, so common behavior (signature check, init, status mapping) isn't re-implemented per provider. Currently `IDmetaProvider.handleWebhook` re-implements signature verification while `WebhooksService` also does it — duplication that already drifted (see C1).

---

### I6. Long-lived provider instance is initialized once and reused across tenants

`verifications.service.ts:67-82`:
```ts
if (!providerInstance.isInitialized) {
  await providerInstance.initialize({apiKey: providerEntity.api_key, ...});
}
```

`providerInstance` is a NestJS singleton. The first tenant request initializes it with their provider's credentials. **Every subsequent tenant request finds `isInitialized === true` and skips re-init**, so it uses Tenant A's credentials when serving Tenant B.

This works today because **all tenants share one IDMeta provider entry** — credentials are the same. The moment you have two `providers` rows of type `multi_step` (e.g., two IDMeta accounts for different commercial tenants, or a sandbox vs prod IDMeta), Tenant B's verification calls IDMeta with Tenant A's API key.

Also: `tenant_overrides` are merged in only on the first init. Any later tenant's overrides are ignored.

**Fix:**
1. Don't cache initialization on the singleton. Either: (a) re-initialize on every call (cheap — it's just setting properties), or (b) restructure to pass credentials as method params instead of init state, or (c) use a per-tenant cached client keyed by `provider_id + tenant_id`.

---

### I7. Bull queue is optional, but `verifications.service.ts` doesn't gracefully degrade

`app.module.ts:28-34`:
```ts
...(process.env.REDIS_HOST ? [BullModule.forRoot(...)] : []),
```

`verifications.service.ts:40` uses `@Optional() @InjectQueue('verification-processing')`. The optional path means `this.verificationQueue` is `undefined` without Redis. A `grep` for `.add(` calls on the queue is needed to be sure, but the pattern of "wire it up optional, then reference it without null-checks" is a common bug. Worth verifying every queue use is null-safe.

`event-publisher.service.ts` similarly uses Redis pub/sub — `webhooks.service.ts:175` calls `await this.eventPublisher.publish(...)` and the WS gateway's local broadcast as a backup. Good there. But the same pattern should be applied for Bull.

**Fix:** add an explicit `if (!this.verificationQueue) return;` (or `throw new ServiceUnavailableException`) at every queue use site, and document that async features are degraded without Redis.

---

### I8. JWT logout / revocation is missing

`auth.service.ts` has `refreshToken()` that revokes the old refresh token on rotation. But there's no `POST /auth/logout`. Access tokens are signed JWTs with no blacklist; once issued, they're valid until their `exp` (default 15min from env example) regardless of "logout".

For a KYC adapter handling PII, "I logged out from a shared computer" should invalidate the access token immediately, not in 15 minutes.

**Fix:** add a JWT revocation list (Redis SET with TTL = remaining token lifetime). Check on every JWT-guarded request via JWT strategy. Or shorten access token expiry to <2min and depend on refresh rotation.

---

### I9. 10MB body parser applied globally

`main.ts:30-31`:
```ts
app.use(json({ limit: '10mb' }));
app.use(urlencoded({ limit: '10mb', extended: true }));
```

10MB applies to **every route**, not just upload routes. Combined with C4 (no rate limit), an attacker can POST 10MB JSON to `/auth/login` and exhaust memory.

**Fix:** apply 10MB only to the document-upload endpoints (`POST /verifications/:id/document`, `/biometrics/*`, `/custom/document`). Keep 100KB default for `/auth/*`, `/admin/*`. NestJS supports per-route raw body parsing.

---

### I10. Webhook log doesn't store remote IP or `x-real-ip` headers

`webhooks.service.ts:40-46` saves `provider_id`, `payload`, `signature`, but not the requester's IP, request ID, or correlation ID. Combined with C1, a webhook forgery would be untraceable — log shows "received and processed" with no clue who sent it.

**Fix:** capture and persist remote IP (behind proxy: trust `X-Forwarded-For` only from known proxies), user-agent, request id. Add to webhook_logs schema.

---

## Minor (nice to have / future-proofing)

### M1. `idmeta-http.client.ts` — 880-line class, `require('axios')` per method

Every IDMeta method does `const axios = require('axios');` at call time. Should be a top-of-file `import axios from 'axios'`. Costs are trivial but signals the file was written piecemeal.

The class itself bundles HTTP, FormData prep, magic-byte image validation, base64 extraction, and ~17 endpoint methods each repeating the same try/catch + `Authorization: Bearer ${apiKey}` + timeout pattern.

**Suggestion:** split into `IDmetaHttpClient` (axios + auth header), `IDmetaImageValidator` (magic bytes + buffer checks, useful for any provider that takes images), and per-feature client classes (`IDmetaPhilippinesClient`, `IDmetaBiometricsClient`, etc.). Use a base class + `request<T>()` helper to remove the try/catch boilerplate.

### M2. `verifications.service.ts` is ~1300 lines and growing

Provider-init boilerplate (~15 lines) repeats in every PH-government verification method (`verifyPhilsysPcn`, `runDocumentVerification`, etc.). A small helper `getInitializedProvider(tenantId): Promise<IDmetaProvider>` would cut hundreds of lines and centralize the "must be IDMeta" check that's currently sprinkled around (`verifications.service.ts:179, 252, ...`).

### M3. Status enum normalization doubles roundtrip

`idmeta.provider.ts:401-409` and friends:
```ts
const numericStatus = normalizeProviderStatus(...)        // string→number
return getLegacyStatusForStorage(numericStatus);          // number→string
```
The intermediate numeric form serves no purpose now; refactor `normalizeProviderStatus` to return a final string directly.

### M4. `webhook_endpoint` template includes provider name verbatim

`admin.service.ts:358, 501`:
```ts
webhook_endpoint: `/v1/webhook/${(config.provider.name || '').toLowerCase()}`,
```
Provider name is human-editable. Renaming a provider changes its public webhook URL silently and breaks every provider configured to call the old slug. Either prevent renames or store an immutable `webhook_slug` column.

### M5. `payload as any` in webhook handler erases types

`idmeta.provider.ts:122`, `webhooks.service.ts:74` — webhook payloads are typed as `unknown`/`any` and accessed via property paths. A `zod` schema for the IDMeta webhook envelope (with `safeParse`) would catch malformed payloads early and document the contract.

### M6. Dynamic `ConfigModule` validation is missing

`app.module.ts:19-22`:
```ts
ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.example'] })
```
`.env.example` is loaded as a fallback — if `.env` is missing in prod, the app boots with example values. There's no `validationSchema` (joi/zod). Combined with C5 (CORS fallback to localhost), missing-env footguns are easy to hit.

**Fix:** add `validationSchema` requiring `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_*`, `CORS_ORIGINS` in production. Drop `.env.example` from `envFilePath`.

### M7. No request-id / correlation-id middleware

Tracing a verification through `initiate → IDMeta → webhook → DB update → WS broadcast → outgoing callback` requires guessing across 5 separate `logger.error/log` calls with no correlation. Add a request-id middleware (Nest's built-in `ClassSerializerInterceptor` + `nestjs-cls`) and pass it to outbound IDMeta calls and webhook payloads.

### M8. PII in error logs

`idmeta-http.client.ts` logs `error.response?.data || error.message` on every failure. IDMeta error responses can include the submitted PCN, license number, or full document field data. Those error responses end up in stdout → Cloud Logging → searchable indefinitely.

**Fix:** strip PII keys from `error.response?.data` before logging. Use a denylist of common field names (`pcn`, `licenseNo`, `crnSsNumber`, `clearanceNo`, `image*`, `pcnFormData`).

### M9. No health check endpoint

`main.ts` exposes `/api/docs` but no `/health` or `/healthz`. Cloud Run, Railway, and GCP load balancers all want one. Should return DB connectivity + Redis (if configured) + a sample provider health check.

### M10. Tests exist but coverage is shallow

5 `.spec.ts` files for a ~10000-line codebase. Quick scan: spec files mock the repositories and test return-shape, not behaviors like "tenant A cannot read tenant B's verification" or "wrong-length signature returns 401, not 500." The "42 unit tests" claim in `SYSTEM_ARCHITECTURE.md:1126-1131` is technically true but doesn't gate against any of the Critical findings above.

---

## Recommendations (process / future-proofing)

1. **Stand up CI with a security baseline.** GitHub Actions or Cloud Build, running:
   - `npm run lint` + typecheck
   - `npm test` (unit) + `npm run test:e2e`
   - `npm audit --production`
   - Snyk/Trivy or `osv-scanner` on dependencies
   - Fail PR on any Critical/High vulnerabilities.
2. **Add a smoke test for tenant isolation.** Create two tenants A and B, verify that a JWT for A cannot read/write/delete any of B's resources via any endpoint. Run on every CI build. This is the highest-value test for a multi-tenant system.
3. **Move secrets out of the DB and into GCP Secret Manager** (you're on GCP). Adapter reads at startup or per-call. Replace `providers.api_key` etc. with `providers.secret_ref: string`.
4. **Add an audit log for every secret-touching admin action** (provider create/update, secret reveal, webhook secret rotation). The `audit_logs` table is referenced in the SYSTEM_ARCHITECTURE doc but I don't see it written to from `admin.service.ts`. Wire it up.
5. **Pin webhook signatures to a request body that includes timestamp + nonce.** Stripe-style: `signature = HMAC(timestamp + '.' + body)`. Reject signatures older than 5 minutes. Defeats replay attacks (relevant once C1 is fixed).
6. **Document the provider-extension path.** A short `docs/adding-a-provider.md` covering: implement `IKycProvider`, register with the factory, write `*.mapper.ts`, add a migration row for the provider, update the slug allowlist. Three places change today; should be one.

---

## Assessment

**Ready for production: No.**

**Reasoning:** C1 (webhook bypass) and C2 (plaintext credentials returned over the API) are exploitable without authentication and without prior account compromise — the first lets an attacker forge KYC verification results, the second leaks live IDMeta API keys to anyone with super admin access whose session ever leaks (browser caches, log access, dev tools). C3 (destructive migrations) is a deploy-time landmine. C4 (no rate limiting) means even after fixing C1/C2, the endpoints are abusable.

The architecture is fundamentally sound — provider abstraction, multi-tenancy, real-time updates are all in the right shape. The Critical findings are concentrated in: webhook security, secrets handling, and operational hygiene (migrations, rate limit). Estimated effort to clear all Critical items: 2-3 focused days. After that, the Important items can be tackled while feature work resumes.

---

## Audit metadata

- **Reviewer:** Claude (Opus 4.7, main session)
- **Scope:** `C:\Users\Datafied\Desktop\chris\KYC\KYC_SYSTEMS\SERVER` only
- **Files sampled (not exhaustive):**
  - `src/main.ts`, `src/app.module.ts`
  - `src/database/entities/{provider,tenant-provider-config}.entity.ts`
  - `src/providers/providers.factory.ts`, `src/providers/implementations/idmeta/{idmeta.provider,idmeta-http.client}.ts`
  - `src/verifications/verifications.{controller,service}.ts` (partial)
  - `src/webhooks/{webhooks.service,webhooks.controller,public-webhooks.controller,webhook-signature.service}.ts`
  - `src/auth/{auth.service,strategies/api-key.strategy,guards/{jwt-or-api-key,tenant-auth}}.ts`
  - `src/admin/admin.service.ts` (partial)
  - `src/common/{encryption,file-storage,rate-limit}.service.ts`
  - `src/database/migrations/{1761600000000-ClearExistingData,1761800000000-ClearVerificationsAndAccounts}.ts`
  - `src/accounts/accounts.controller.ts`
- **Not deeply audited (worth a follow-up pass):** verification-status enum logic, websocket gateway auth, tenant.service, full migration sequence, e2e test depth, IDMeta request/response mappers.
