# User Search Endpoint Documentation

## Overview

The `/admin/users` endpoint allows admins to search and filter users of the KYC adapter system. This endpoint searches for **system users** (super admins, tenant admins, tenant users), NOT the validated end-user accounts from verifications.

## Endpoint

```
GET /admin/users
```

## Authentication

Requires JWT authentication with super admin privileges.

```
Authorization: Bearer <jwt_token>
```

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | No | - | Search users by name or email (supports partial matches) |
| `page` | number | No | 1 | Page number for pagination |
| `limit` | number | No | 10 | Number of items per page |
| `tenantId` | string | No | - | Filter users by specific tenant ID |
| `includeSuperAdmins` | boolean | No | false | Include super admins in results |
| `userTypes` | string | No | - | Filter by user types (comma-separated: `super_admin,tenant_admin,tenant_user`) |

## User Types

- `super_admin` - System administrators (no tenant_id)
- `tenant_admin` - Tenant administrators (has tenant_id)
- `tenant_user` - Regular tenant users (has tenant_id)

## Examples

### Example 1: Search for a specific user

```bash
GET /admin/users?query=john@example.com
```

**Response:**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "john@example.com",
      "name": "John Doe",
      "user_type": "tenant_admin",
      "status": "active",
      "tenant_id": "tenant-123",
      "phone": "+1234567890",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z",
      "tenant": {
        "id": "tenant-123",
        "name": "Acme Corp",
        "email": "contact@acme.com"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1,
  "query": "john@example.com"
}
```

### Example 2: Filter by tenant

```bash
GET /admin/users?tenantId=tenant-123
```

Returns all users belonging to the specified tenant.

### Example 3: Filter by user type

```bash
GET /admin/users?userTypes=tenant_admin,tenant_user
```

Returns only tenant admins and tenant users (excludes super admins).

### Example 4: Include super admins

```bash
GET /admin/users?includeSuperAdmins=true
```

Returns all users including super admins.

### Example 5: Combined filters

```bash
GET /admin/users?query=john&tenantId=tenant-123&userTypes=tenant_admin&page=1&limit=20
```

Returns tenant admins named "john" in tenant-123, first page with 20 results per page.

## Response Structure

```typescript
{
  data: UserResponseDto[];      // Array of users
  total: number;                 // Total number of matching users
  page: number;                  // Current page number
  limit: number;                 // Items per page
  totalPages: number;            // Total number of pages
  query: string;                 // Search query used
}
```

## User Response Structure

```typescript
{
  id: string;                    // User UUID
  email: string;                 // User email
  name: string;                  // User name
  user_type: 'super_admin' | 'tenant_admin' | 'tenant_user';
  status: 'active' | 'inactive' | 'suspended';
  tenant_id?: string;           // Tenant ID (null for super admins)
  phone?: string;               // Phone number
  created_at: Date;             // Creation timestamp
  updated_at: Date;             // Last update timestamp
  tenant?: {                    // Tenant information (if applicable)
    id: string;
    name: string;
    email: string;
  }
}
```

## Important Notes

1. **Default Behavior**: By default, super admins are excluded from results unless `includeSuperAdmins=true` is specified.

2. **Empty Query**: If `query` is empty and no `tenantId` is provided, an empty result set is returned.

3. **Wildcard Search**: When `tenantId` is provided without a `query`, a wildcard search is performed to return all users for that tenant.

4. **Tenant Isolation**: The search respects tenant boundaries and only returns users accessible to the authenticated admin.

5. **Not Verified Accounts**: This endpoint searches for **system users** of the KYC adapter (admins, tenant admins, tenant users), NOT the validated end-user accounts from verifications. For verified accounts, use the `/accounts` endpoints.

## Use Cases

1. **User Management**: Find specific users to manage their permissions
2. **Tenant User List**: Get all users belonging to a specific tenant
3. **User Type Filtering**: View only certain types of users (e.g., all tenant admins)
4. **Search by Email**: Quickly find a user by their email address
5. **Multi-tenant Administration**: Super admins can search across all tenants

## Related Endpoints

- `GET /accounts` - Search for validated end-user accounts from verifications
- `GET /admin/tenants` - List all tenants
- `GET /admin/dashboard` - Get admin dashboard statistics

