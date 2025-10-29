import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { TenantAuthGuard } from './tenant-auth.guard';

@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers || {};

    const apiKeysOnly = String(process.env.API_KEYS_ONLY || '').toLowerCase() === 'true';
    const rawAuth: string | undefined = headers['authorization'];
    const xApiKey: string | undefined = headers['x-api-key'];

    const hasApiKeyHeader = Boolean(xApiKey) || (rawAuth && /^ApiKey\s+/i.test(rawAuth));

    // If API_KEYS_ONLY is enabled, require API key
    if (apiKeysOnly) {
      if (!hasApiKeyHeader) {
        throw new UnauthorizedException('API key required');
      }
      // Authenticate via API key strategy
      const apiKeyGuard = new ApiKeyAuthGuard();
      return apiKeyGuard.canActivate(context) as unknown as boolean;
    }

    // Flexible mode: prefer API key if present, else JWT
    if (hasApiKeyHeader) {
      const apiKeyGuard = new ApiKeyAuthGuard();
      return apiKeyGuard.canActivate(context) as unknown as boolean;
    }

    // Fallback to JWT and enforce tenant access rules
    const jwtGuard = new JwtAuthGuard();
    const jwtOk = await (jwtGuard.canActivate(context) as unknown as Promise<boolean>);
    if (!jwtOk) return false;

    // Enforce tenant access guard (allows super_admin, requires tenant for others)
    const tenantGuard = new TenantAuthGuard();
    return tenantGuard.canActivate(context);
  }
}



