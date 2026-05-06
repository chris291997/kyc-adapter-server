import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { SuperAdminAuthGuard } from '../auth/guards/super-admin-auth.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto, UpdateTenantStatusDto, UpdateTenantQuotaDto } from './dto/update-tenant.dto';
import { CreateTenantProviderConfigDto, UpdateTenantProviderConfigDto } from './dto/tenant-provider-config.dto';
import { CreateProviderDto, UpdateProviderDto, UpdateProviderStatusDto } from './dto/provider.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Get all tenants' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
  async getTenants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    
    if (search) {
      return this.adminService.searchTenants(search, pageNum, limitNum);
    }
    
    return this.adminService.getAllTenants(pageNum, limitNum);
  }

  @Get('users')
  @ApiOperation({ summary: 'Search users (excludes super admins by default)' })
  @ApiQuery({
    name: 'query',
    required: false,
    type: String,
    description: 'Optional search term for user name or email (empty returns all)'
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)'
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    type: String,
    description: 'Optional tenant ID filter (super admins only). If not provided, returns users for current user\'s tenant.'
  })
  @ApiQuery({
    name: 'includeSuperAdmins',
    required: false,
    type: Boolean,
    description: 'Include super admin users in results (default: false)'
  })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async searchUsers(
    @Req() req: any,
    @Query('query') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tenantId') tenantId?: string,
    @Query('includeSuperAdmins') includeSuperAdmins?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const includeSuper = includeSuperAdmins === 'true';

    // For tenant users, if no tenantId is provided, use their own tenantId
    // For super admins, tenantId is optional (can view all tenants or filter by tenant)
    let effectiveTenantId = tenantId;

    if (!tenantId && req.user.tenantId) {
      // Tenant user - use their own tenantId
      effectiveTenantId = req.user.tenantId;
    }
    const safeQuery = (query ?? '').trim();
    return this.adminService.searchUsers(safeQuery, pageNum, limitNum, effectiveTenantId, includeSuper);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Get all providers' })
  @ApiResponse({ status: 200, description: 'Providers retrieved successfully' })
  async getProviders() {
    return this.adminService.getAllProviders();
  }

  @Get('verifications')
  @ApiOperation({ summary: 'Get all verifications' })
  @ApiResponse({ status: 200, description: 'Verifications retrieved successfully' })
  async getVerifications(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getAllVerifications(pageNum, limitNum);
  }

  // Tenant CRUD Operations
  @Post('tenants')
  @ApiOperation({ summary: 'Create new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 409, description: 'Tenant with this email already exists' })
  async createTenant(@Body() createTenantDto: CreateTenantDto) {
    return this.adminService.createTenant(createTenantDto);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getTenant(@Param('id') id: string) {
    return this.adminService.getTenant(id);
  }

  @Put('tenants/:id')
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async updateTenant(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto
  ) {
    return this.adminService.updateTenant(id, updateTenantDto);
  }

  @Put('tenants/:id/status')
  @ApiOperation({ summary: 'Update tenant status (active/inactive/suspended)' })
  @ApiResponse({ status: 200, description: 'Tenant status updated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async updateTenantStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateTenantStatusDto
  ) {
    return this.adminService.updateTenantStatus(id, updateStatusDto);
  }

  @Put('tenants/:id/quota')
  @ApiOperation({ summary: 'Update tenant verification quota' })
  @ApiResponse({ status: 200, description: 'Tenant quota updated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async updateTenantQuota(
    @Param('id') id: string,
    @Body() updateQuotaDto: UpdateTenantQuotaDto
  ) {
    return this.adminService.updateTenantQuota(id, updateQuotaDto);
  }

  @Delete('tenants/:id')
  @ApiOperation({ summary: 'Delete tenant' })
  @ApiResponse({ status: 200, description: 'Tenant deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async deleteTenant(@Param('id') id: string) {
    return this.adminService.deleteTenant(id);
  }

  // Tenant Provider Configuration Management
  @Get('tenants/:id/providers')
  @ApiOperation({ summary: 'Get tenant provider configurations' })
  @ApiResponse({ status: 200, description: 'Provider configurations retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getTenantProviderConfigs(@Param('id') tenantId: string) {
    return this.adminService.getTenantProviderConfigs(tenantId);
  }


  @Get('tenants/:id/providers/:configId')
  @ApiOperation({ summary: 'Get specific tenant provider configuration' })
  @ApiResponse({ status: 200, description: 'Provider configuration retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  async getTenantProviderConfig(
    @Param('id') tenantId: string,
    @Param('configId') configId: string
  ) {
    return this.adminService.getTenantProviderConfig(tenantId, configId);
  }

  @Put('tenants/:id/providers/:configId')
  @ApiOperation({ summary: 'Update tenant provider configuration' })
  @ApiResponse({ status: 200, description: 'Provider configuration updated successfully' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  async updateTenantProviderConfig(
    @Param('id') tenantId: string,
    @Param('configId') configId: string,
    @Body() updateConfigDto: UpdateTenantProviderConfigDto
  ) {
    return this.adminService.updateTenantProviderConfig(tenantId, configId, updateConfigDto);
  }

  @Delete('tenants/:id/providers/:configId')
  @ApiOperation({ summary: 'Remove provider from tenant' })
  @ApiResponse({ status: 200, description: 'Provider removed successfully' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  async deleteTenantProviderConfig(
    @Param('id') tenantId: string,
    @Param('configId') configId: string
  ) {
    return this.adminService.deleteTenantProviderConfig(tenantId, configId);
  }

  @Post('tenants/:id/providers')
  @ApiOperation({ summary: 'Assign provider to tenant' })
  @ApiResponse({ status: 201, description: 'Provider assigned successfully' })
  @ApiResponse({ status: 404, description: 'Tenant or provider not found' })
  @ApiResponse({ status: 409, description: 'Provider already assigned to tenant' })
  async createTenantProviderConfig(
    @Param('id') tenantId: string,
    @Body() createConfigDto: CreateTenantProviderConfigDto
  ) {
    return this.adminService.createTenantProviderConfig(tenantId, createConfigDto);
  }

  // Provider Management
  @Post('providers')
  @ApiOperation({ summary: 'Register new provider' })
  @ApiResponse({ status: 201, description: 'Provider registered successfully' })
  @ApiResponse({ status: 409, description: 'Provider with this name already exists' })
  @ApiResponse({ status: 400, description: 'Invalid provider data' })
  async createProvider(@Body() createProviderDto: CreateProviderDto) {
    return this.adminService.createProvider(createProviderDto);
  }

  @Get('providers/:id')
  @ApiOperation({ summary: 'Get provider details' })
  @ApiResponse({ status: 200, description: 'Provider details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async getProvider(@Param('id') id: string) {
    return this.adminService.getProvider(id);
  }

  @Put('providers/:id')
  @ApiOperation({ summary: 'Update provider' })
  @ApiResponse({ status: 200, description: 'Provider updated successfully' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  @ApiResponse({ status: 409, description: 'Provider name already exists' })
  async updateProvider(
    @Param('id') id: string,
    @Body() updateProviderDto: UpdateProviderDto
  ) {
    return this.adminService.updateProvider(id, updateProviderDto);
  }

  @Put('providers/:id/status')
  @ApiOperation({ summary: 'Enable or disable provider' })
  @ApiResponse({ status: 200, description: 'Provider status updated successfully' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async updateProviderStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateProviderStatusDto
  ) {
    return this.adminService.updateProviderStatus(id, updateStatusDto);
  }

  @Delete('providers/:id')
  @ApiOperation({ summary: 'Delete provider (soft delete - deactivates)' })
  @ApiResponse({ status: 200, description: 'Provider deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  @ApiResponse({ status: 409, description: 'Provider is in use and cannot be deleted' })
  async deleteProvider(@Param('id') id: string) {
    return this.adminService.deleteProvider(id);
  }

  @Post('providers/:id/test')
  @ApiOperation({ summary: 'Test provider connection' })
  @ApiResponse({ status: 200, description: 'Provider test completed' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async testProviderConnection(@Param('id') id: string) {
    return this.adminService.testProviderConnection(id);
  }

  @Post('providers/:id/reveal-secrets')
  @UseGuards(JwtAuthGuard, SuperAdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'One-time reveal of provider secrets for super admin (audit-logged)' })
  @ApiResponse({ status: 200, description: 'Secrets returned once' })
  @ApiResponse({ status: 403, description: 'Not super admin' })
  async revealProviderSecrets(@Param('id') id: string, @Request() req) {
    return this.adminService.revealProviderSecrets(id, req.user.id);
  }
}

