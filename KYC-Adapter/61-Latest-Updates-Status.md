# Latest Updates & Status

## 🚀 Recent Major Changes

### ✅ Centralized Provider Configuration (Latest)

**Date:** Current
**Status:** ✅ Completed

**What Changed:**
- **Provider credentials are now centralized** at the provider level
- **Tenants are assigned providers**, not configure them
- Removed tenant-level webhook fields (`webhook_url`, `webhook_events`, `webhook_secret`)
- All credentials (`api_key`, `secret_key`, `webhook_secret`) managed by super admin only

**Database Changes:**
- `providers` table: Added `api_key`, `secret_key`, `webhook_secret` columns
- `tenant_provider_configs` table: Renamed `config` → `tenant_overrides` (now optional)
- `tenants` table: Removed `webhook_url`, `webhook_events`, `webhook_secret`

**API Changes:**
- ✅ `GET /admin/providers` - List all providers (with credential status)
- ✅ `GET /admin/providers/:id` - Get provider with full credentials
- ✅ `PUT /admin/providers/:id` - Update provider credentials
- ✅ `POST /admin/tenants/:tenantId/providers/:providerId/assign` - Assign provider to tenant
- ✅ `GET /admin/tenants/:tenantId/provider-assignments` - List tenant's assigned providers
- ✅ `PUT /admin/tenants/:tenantId/provider-assignments/:assignmentId` - Update assignment
- ✅ `DELETE /admin/tenants/:tenantId/provider-assignments/:assignmentId` - Remove assignment
- ❌ **Removed:** `PUT /admin/tenants/:tenantId/providers/:configId` (old tenant config update)

**Migrations:**
1. `1761600000000-ClearExistingData.ts` - Optional: Clear existing data for fresh start
2. `1761600100000-RemoveTenantWebhookFields.ts` - Remove deprecated tenant webhook fields
3. `1761700000000-CentralizeProviderConfig.ts` - Add provider credential columns

**Documentation Updated:**
- [[11-Provider-Management|Provider Management]] - Completely rewritten
- [[55-Development-Prompts|Development Prompts]] - Updated for centralized config
- This file

**Frontend Impact:**
- **Remove:** Tenant provider configuration UI
- **Add:** Super admin provider management UI
- **Add:** Super admin provider assignment UI
- **Update:** Tenant view to show assigned providers (read-only)

---

### ✅ Webhook Architecture Clarification

**Status:** ✅ Completed

**Two Types of Webhooks:**

1. **Provider → Adapter (Inbound)**
   - Static URL per provider: `/v1/webhook/{provider-name-slug}`
   - Example: `/v1/webhook/idmeta`
   - Secret: Provider-level HMAC (managed by super admin)
   - Purpose: Provider sends verification updates to adapter

2. **Adapter → Client (Outbound)**
   - URL: `callbackUrl` (provided by client during verification initiation)
   - Secret: System-level (`WEBHOOK_SECRET` env var)
   - Purpose: Adapter sends verification updates to client's system

**Key Points:**
- Webhook URLs are **auto-generated** and **static**
- Only webhook **secret** is configurable
- Super admin provides URL + secret to provider dashboard
- Tenants never manage webhooks

---

### ✅ User Search & Management Improvements

**Status:** ✅ Completed

**Features:**
- UUID search support
- Empty query returns all users
- Sorting by user_type and created_at
- Super admin exclusion by default
- `includeSuperAdmins` parameter

**Endpoints:**
- `GET /admin/users` - Search users (excludes super admins by default)
- `GET /tenant/users` - Get tenant users (always excludes super admins)

---

### ✅ JWT & API Key Combined Authentication

**Status:** ✅ Completed

**Features:**
- `JwtOrApiKeyGuard` - Accepts either JWT or API Key
- `API_KEYS_ONLY` toggle - Force API key authentication
- Tenant ID derived from token (never from query params)

**Endpoints:**
- `POST /verifications/initiate` - Supports both JWT and API Key
- `POST /verifications/test` - JWT-based test verification (tenant)
- `POST /verifications/admin/tenants/:tenantId/test` - JWT-based test verification (admin)

---

### ✅ Super Admin Account Access

**Status:** ✅ Completed

**Features:**
- Super admins can view all accounts
- Super admins can filter by `tenantId`
- Tenant users restricted to their own accounts

**Endpoint:**
- `GET /accounts?tenantId=xxx` - Optional tenantId filter (super admin only)

---

### ✅ API Key Management Updates

**Status:** ✅ Completed

**Features:**
- Sanitized API key list (no `key_hash` exposure)
- Super admins can filter by `tenantId`
- Tenant users see only their API keys

**Endpoint:**
- `GET /tenant/api-keys?tenantId=xxx` - Optional tenantId filter (super admin only)

---

## 📋 Implementation Checklist

### Backend (Completed)
- ✅ Centralized provider entity with credentials
- ✅ Simplified tenant-provider assignment
- ✅ Provider management endpoints
- ✅ Provider assignment endpoints
- ✅ Migrations for schema changes
- ✅ Updated ProvidersFactory
- ✅ Updated VerificationsService
- ✅ Updated WebhooksService
- ✅ Updated AdminService
- ✅ Documentation updated

### Frontend (Pending)
- ⏳ Provider management page (super admin)
- ⏳ Provider assignment page (super admin)
- ⏳ Assigned providers view (tenant, read-only)
- ⏳ Remove tenant provider configuration UI
- ⏳ Update API client for new endpoints
- ⏳ Update forms and validation

---

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/kyc_adapter

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=1h

# API Keys
API_KEYS_ONLY=false  # Set to true to force API key auth on /verifications/initiate

# Webhooks
WEBHOOK_SECRET=your-system-webhook-secret  # For outgoing webhooks (adapter → client)

# Provider Defaults (fallback if not set in provider config)
IDMETA_BASE_URL=https://integrate.idmetagroup.com/api
```

---

## 🧪 Testing

### Manual Testing Steps

1. **Run Migrations**
```bash
npm run migration:run
```

2. **Create/Update Provider**
```bash
PUT /admin/providers/:id
{
  "api_key": "pk_live_xxx",
  "secret_key": "sk_live_xxx",
  "webhook_secret": "whsec_generated_hmac",
  "base_url": "https://integrate.idmetagroup.com/api"
}
```

3. **Assign Provider to Tenant**
```bash
POST /admin/tenants/:tenantId/providers/:providerId/assign
{
  "priority": 1
}
```

4. **Initiate Verification** (uses centralized credentials)
```bash
POST /verifications/initiate
Headers: Authorization: Bearer {jwt}
{
  "verificationType": "individual",
  "userEmail": "test@example.com"
}
```

5. **Verify Webhook** (provider sends update)
```bash
POST /v1/webhook/idmeta
Headers: X-Webhook-Signature: {signature}
{
  "verification_id": "xxx",
  "status": "completed"
}
```

### Automated Tests

```bash
npm run test
```

---

## 📚 Related Documentation

- [[11-Provider-Management|Provider Management]] - Provider configuration & assignment
- [[14-Webhook-System|Webhook System]] - Webhook architecture
- [[55-Development-Prompts|Development Prompts]] - Frontend integration guide
- [[51-API-Reference-Complete|API Reference]] - Complete API documentation
- [[SYSTEM_ARCHITECTURE.md]] - System architecture overview

---

## 🐛 Known Issues

None at this time.

---

## 📝 Notes for Developers

### Provider Setup Workflow (Super Admin)

1. Create provider (if not exists): `POST /admin/providers`
2. Configure credentials: `PUT /admin/providers/:id`
   - Set `api_key`, `secret_key`, `webhook_secret`, `base_url`
3. Get webhook URL: `/v1/webhook/{provider-name-slug}`
4. Configure provider dashboard (e.g., IDmeta):
   - Provide webhook URL
   - Provide webhook secret (HMAC)
5. Assign provider to tenant: `POST /admin/tenants/:tenantId/providers/:providerId/assign`
6. Test verification: `POST /verifications/initiate`

### Webhook Secret Generation

```typescript
// Generate secure HMAC (frontend or backend)
const crypto = require('crypto');
const webhookSecret = crypto.randomBytes(32).toString('base64');

// Update provider
PUT /admin/providers/:id
{
  "webhook_secret": webhookSecret
}

// Provide to provider dashboard
console.log('Webhook URL:', '/v1/webhook/idmeta');
console.log('Webhook Secret:', webhookSecret);
```

---

**Back to**: [[00-INDEX|Index]]

