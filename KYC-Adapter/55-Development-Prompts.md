# Development Prompts & Agent Instructions

# Frontend Development Prompt (Definitive)

As a professional frontend developer, thoroughly read and internalize the documentation before coding. Use [[59-Frontend-Integration-Guide]] (flows, examples), [[60-Frontend-Requirements]] (UI/UX specs), and [[51-API-Reference-Complete]] (API details). Do not duplicate docs into code; reference them faithfully.

Copy/paste this prompt in your chat to begin:

```markdown
You are building the KYC Adapter frontend.

## IMPORTANT: Centralized Provider Configuration

**Providers are now managed centrally by super admins.** Tenants are simply **assigned** providers. Credentials (API keys, secrets, webhook HMAC) are stored at the **provider level**, not tenant level.

Context
- Backend is complete and documented (Swagger at http://localhost:3000/api/docs).
- Multi-tenant RBAC: super_admin, tenant_admin, tenant_user.
- Do NOT send tenantId in any request; backend derives it from JWT/API key.
- Toggle API_KEYS_ONLY=true to force API-key-only auth for /verifications/initiate.
- **Webhooks are provider-level**, not tenant-level:
  - Generated endpoint format: https://localhost:3000/v1/webhook/{PROVIDER_NAME} (URL-safe name, e.g., "idmeta")
  - Only super_admin can set/update credentials and webhook secret
  - Tenants are just **assigned** providers (no credential access)

Goal
- One React + TypeScript app with role-based dashboards (super_admin, tenant_admin, tenant_user).
- Implement verification initiation + real-time updates, **centralized provider management** (admin-only), and tenant API keys.
- Modern, responsive UI with light/dark theme toggle and accessibility (WCAG AA).

Stack
- React 18 + TypeScript, Vite
- Tailwind CSS, Headless UI, Framer Motion
- React Router, React Query, Zustand/Redux Toolkit
- Axios, Socket.IO client
- Recharts, Lucide/Heroicons

Routing
- /admin/* (super_admin only)
- /tenant/* (tenant_admin, tenant_user)
- Post-login, route by decoded JWT userType

Core Features

1) Verifications
- Start: POST /verifications/initiate (JWT or API Key)
- Status: GET /verifications/:id/status
- Realtime: WebSocket channel "verification:<id>"
- UI: start → open sessionUrl if present → subscribe WS → show live status → poll fallback

2) Provider Management (Admin-Only) - **UPDATED**

**Super Admin - Provider Configuration:**
- GET /admin/providers - List all providers
- GET /admin/providers/:id - Get provider with full credentials
- PUT /admin/providers/:id - Update provider credentials
- POST /admin/providers/:id/test - Test provider connection

**Provider Fields:**
- name, type, base_url, api_version
- api_key (masked in list, shown in detail view)
- secret_key (masked in list, shown in detail view)
- webhook_secret (HMAC, masked in list, shown in detail view)
- webhook_endpoint (auto-generated, read-only): `/v1/webhook/{provider-name-slug}`

**Provider Assignment to Tenants:**
- GET /admin/tenants/:tenantId/provider-assignments - List assigned providers
- POST /admin/tenants/:tenantId/providers/:providerId/assign - Assign provider
- PUT /admin/tenants/:tenantId/provider-assignments/:assignmentId - Update priority/enabled
- DELETE /admin/tenants/:tenantId/provider-assignments/:assignmentId - Remove assignment

**Important:**
- Tenants **cannot** see or edit provider credentials
- Tenants **can** see which providers are assigned to them (read-only)
- All credentials managed centrally by super admin

3) Tenant API Keys
- List API keys for current tenant: GET /tenant/api-keys
- Super admin may filter via tenantId query

4) Users & Accounts
- Tenant users: GET /tenant/users?page&limit&query
- Accounts: GET /accounts?page&limit[&tenantId] (tenantId optional and super_admin-only)

WebSocket Contract
- Channel: verification:<verificationId>
- Payload: { verificationId, status, provider, updatedAt, result? }
- Use WS as primary; poll GET /verifications/:id/status as fallback.

Auth Rules
- Dashboard flows use JWT (Bearer).
- External integrations can use API Key:
  - X-API-Key: <key> or Authorization: ApiKey <key>
- Never pass tenantId in query/body.
- When API_KEYS_ONLY=true, reject JWT on /verifications/initiate.

UX Requirements
- Elegant, card-based dashboards; smooth transitions.
- Light/Dark theme toggle with local persistence.
- Responsive layout; keyboard navigation; clear focus states.

Implementation Order
1) Project setup + theme system
2) Auth (login, token storage, role-based guards, route by userType)
3) Axios client (interceptors, error normalization, auth headers)
4) Layouts and routes (admin vs tenant)
5) Verifications (initiate, WS subscription, status polling)
6) **Admin provider management (centralized credentials)**
7) **Admin provider assignment (link providers to tenants)**
8) Tenant API keys + Users/Accounts list
9) Testing (RTL + Cypress), performance polish

Deliverables
- Single React app with role-based dashboards
- End-to-end verification flow with realtime updates
- **Admin-only centralized provider management (full CRUD)**
- **Admin provider assignment UI (assign/unassign providers to tenants)**
- Tenant assigned providers view (read-only, no credentials)
- Tenant API key list (sanitized; no key_hash exposure)
- README with env, scripts, and setup

References (read thoroughly, do not duplicate content)
- Flows and code examples: 59-Frontend-Integration-Guide
- UI/UX specs: 60-Frontend-Requirements
- API details: 51-API-Reference-Complete
- Provider Management: 11-Provider-Management
```

## Admin UX - Provider Management (Super Admin Only)

### 1. Provider List Page

**Path:** `/admin/providers`

**Features:**
- List all providers with status indicators
- Show: name, type, base_url, api_key_set ✓/✗, webhook_secret_set ✓/✗
- Actions: View Details, Edit, Test Connection
- Add Provider button

### 2. Provider Detail/Edit Modal

```
Provider: IDmeta
Type: Multi-Step
Base URL: https://integrate.idmetagroup.com/api
API Version: v1

--- Credentials (Super Admin Only) ---
API Key: [input/masked] [Show/Hide] [Copy]
Secret Key: [input/masked] [Show/Hide] [Copy]
Webhook Secret: [input/masked] [Show/Hide] [Copy] [Generate HMAC]

--- Webhook Configuration (Read-Only) ---
Webhook URL: https://yourdomain.com/v1/webhook/idmeta [Copy]
📋 Instructions: Copy this URL and the Webhook Secret to configure in IDmeta's dashboard

--- Advanced Settings ---
Timeout: 30000ms
Retry Attempts: 3

[Save] [Cancel] [Test Connection]
```

### 3. Generate HMAC Secret Feature

- Button: "Generate Webhook Secret"
- Confirmation modal: "⚠️ This will replace the existing secret. Providers using the old secret will fail. Continue?"
- Generate: `crypto.randomBytes(32).toString('base64')`
- Display new secret **once** in modal with copy button
- After modal closes, secret is masked
- **Never log** the secret

### 4. Provider Assignment Page

**Path:** `/admin/tenants/:tenantId/providers`

**UI:**
```
Assigned Providers for Tenant: Acme Corp

Provider          Type         Priority  Status    Actions
IDmeta            Multi-Step   1         Enabled   [Edit Priority] [Remove]
Mock Provider     Mock         2         Disabled  [Edit Priority] [Remove]

[+ Assign Provider]
```

**Assign Provider Modal:**
```
Select Provider: [Dropdown - show providers not yet assigned]
Priority: [1] (lower = higher priority)

[Assign] [Cancel]
```

**Edit Assignment Modal:**
```
Provider: IDmeta
Priority: [1]
Enabled: [✓]

[Save] [Cancel]
```

### Important Notes

- **Tenants cannot see provider credentials**
- **Tenants cannot configure providers**
- **Only super admins manage providers centrally**
- **Tenants are just assigned providers** (like assigning a tool)
- **Tenant view is read-only:** shows which providers are assigned, priorities, enabled status

---

**Back to**: [[00-INDEX|Index]]

