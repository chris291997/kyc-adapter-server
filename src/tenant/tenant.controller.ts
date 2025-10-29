import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';

@ApiTags('Tenant')
@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantAuthGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get tenant dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  async getDashboardStats(@Req() req: any) {
    return this.tenantService.getDashboardStats(req.user.tenantId);
  }

  @Get('verifications')
  @ApiOperation({ summary: 'Get tenant verifications' })
  @ApiResponse({ status: 200, description: 'Verifications retrieved successfully' })
  async getVerifications(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string
  ) {
    return this.tenantService.getVerifications(req.user.tenantId, page, limit, status);
  }

  @Get('verifications/:id')
  @ApiOperation({ summary: 'Get specific verification' })
  @ApiResponse({ status: 200, description: 'Verification retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  async getVerification(
    @Req() req: any,
    @Param('id') verificationId: string
  ) {
    return this.tenantService.getVerification(req.user.tenantId, verificationId);
  }

  @Get('api-keys')
  @ApiOperation({ summary: 'Get tenant API keys' })
  @ApiResponse({ status: 200, description: 'API keys retrieved successfully' })
  @ApiQuery({ name: 'tenantId', required: false, type: String, description: 'Optional tenantId (super admins only)' })
  async getApiKeys(@Req() req: any, @Query('tenantId') tenantId?: string) {
    const isSuperAdmin = req.user.userType === 'super_admin';
    const effectiveTenantId = isSuperAdmin && tenantId ? tenantId : req.user.tenantId;
    return this.tenantService.getApiKeys(effectiveTenantId);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get users for the tenant (excludes super admins)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getUsers(
    @Req() req: any,
    @Query('query') query?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    const pageNum = page || 1;
    const limitNum = limit || 10;
    const searchQuery = query || '';
    return this.tenantService.getUsers(req.user.tenantId, searchQuery, pageNum, limitNum);
  }
}

