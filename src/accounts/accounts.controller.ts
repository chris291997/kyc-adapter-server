import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@ApiTags('Accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard, TenantAuthGuard)
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get all accounts (supports optional tenantId filter for super admins)',
    description: 'Returns accounts for the current user\'s tenant. Super admins can optionally filter by tenantId to view specific tenant accounts.'
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
    description: 'Optional tenant ID filter (super admins only). If not provided, returns accounts for user\'s tenant or all accounts for super admin.' 
  })
  @ApiResponse({ status: 200, description: 'Accounts retrieved successfully' })
  async findAll(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('tenantId') filterTenantId?: string
  ) {
    // If filterTenantId is provided (super admin filtering), use it
    // Otherwise, use the user's tenantId (for tenant users) or null (for super admin viewing all)
    let tenantId: string | null;
    
    if (filterTenantId) {
      // Super admin filtering by specific tenant
      tenantId = filterTenantId;
    } else if (req.user.tenantId) {
      // Regular tenant user - use their tenantId
      tenantId = req.user.tenantId;
    } else {
      // Super admin viewing all accounts
      tenantId = null;
    }
    
    return this.accountsService.findAll(tenantId, page, limit);
  }

  @Get('search/:query')
  @ApiOperation({ summary: 'Search accounts by email, name, or reference ID' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  async searchAccounts(
    @Request() req,
    @Param('query') query: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.accountsService.searchAccounts(tenantId, query, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific account by ID' })
  @ApiResponse({ status: 200, description: 'Account retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async findOne(@Request() req, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.accountsService.findOne(tenantId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiResponse({ status: 200, description: 'Account updated successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateAccountDto: UpdateAccountDto
  ) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.accountsService.update(tenantId, id, updateAccountDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async remove(@Request() req, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.accountsService.remove(tenantId, id);
  }

  @Get(':id/verifications')
  @ApiOperation({ summary: 'Get all verifications for a specific account' })
  @ApiResponse({ status: 200, description: 'Verifications retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccountVerifications(
    @Request() req,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.accountsService.getAccountVerifications(tenantId, id, page, limit);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Get all documents/images for a specific account' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccountDocuments(@Request() req, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.accountsService.getAccountDocuments(tenantId, id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get account statistics (verification counts, documents, etc.)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccountStats(@Request() req, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.accountsService.getAccountStats(tenantId, id);
  }
}

