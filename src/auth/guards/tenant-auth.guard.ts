import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Allow super admins and tenant users
    if (!user.tenantId && user.userType !== 'super_admin') {
      throw new ForbiddenException('Tenant access required');
    }

    return true;
  }
}

