import { Controller, Post, Get, Put, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { VerificationsService } from './verifications.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { OverrideVerificationDto } from './dto/override-verification.dto';
import { PhilsysPcnDto } from './dto/philsys-pcn.dto';
import { DocumentVerificationDto } from './dto/document-verification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyAuthGuard } from '../auth/guards/api-key-auth.guard';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@ApiTags('Verifications')
@Controller('verifications')
export class VerificationsController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Post('initiate')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Initiate a new verification' })
  @ApiResponse({ status: 201, description: 'Verification initiated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async initiateVerification(
    @Request() req,
    @Body() createVerificationDto: CreateVerificationDto
  ) {
    // Always derive tenantId from token (JWT or API key). Ignore query param.
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    return this.verificationsService.createVerification(
      tenantId,
      createVerificationDto
    );
  }

  // Tenant/Admin test endpoint (JWT-based) – no API key required
  @Post('test')
  @UseGuards(JwtAuthGuard, TenantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test verification for current tenant (JWT, no API key needed)' })
  @ApiResponse({ status: 201, description: 'Test verification created successfully' })
  async testVerification(
    @Request() req,
    @Body() dto: CreateVerificationDto
  ) {
    return this.verificationsService.createVerification(req.user.tenantId, dto);
  }

  // Super admin can test on behalf of any tenant
  @Post('admin/tenants/:tenantId/test')
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test verification for a specific tenant (super admin only)' })
  @ApiResponse({ status: 201, description: 'Test verification created successfully for tenant' })
  async adminTestVerificationForTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateVerificationDto
  ) {
    return this.verificationsService.createVerification(tenantId, dto);
  }

  @Get(':id')
  @UseGuards(ApiKeyAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get verification details' })
  @ApiResponse({ status: 200, description: 'Verification retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  async getVerification(@Param('id') id: string, @Request() req) {
    return this.verificationsService.getVerification(id, req.user.tenantId);
  }

  @Get(':id/status')
  @UseGuards(ApiKeyAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get verification status' })
  @ApiResponse({ status: 200, description: 'Status retrieved successfully' })
  async getVerificationStatus(@Param('id') id: string, @Request() req) {
    return this.verificationsService.getVerificationStatus(id, req.user.tenantId);
  }

  @Post(':id/documents')
  @UseGuards(ApiKeyAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Upload document for verification' })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid document or verification status' })
  async uploadDocument(
    @Param('id') id: string,
    @Body() uploadDto: UploadDocumentDto,
    @Request() req
  ) {
    return this.verificationsService.uploadDocument(id, uploadDto, req.user.tenantId);
  }

  @Post(':id/document')
  @UseGuards(ApiKeyAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Run Document Verification for an initialized verification' })
  @ApiResponse({ status: 200, description: 'Document verification executed' })
  async runDocumentVerification(
    @Param('id') id: string,
    @Body() dto: DocumentVerificationDto,
    @Request() req
  ) {
    return this.verificationsService.runDocumentVerification(req.user.tenantId, {
      verificationId: id,
      templateId: dto.templateId,
      imageFrontSide: dto.imageFrontSide,
      imageBackSide: dto.imageBackSide,
    });
  }

  @Put(':id/override')
  @UseGuards(JwtAuthGuard, TenantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Override verification decision' })
  @ApiResponse({ status: 200, description: 'Verification overridden successfully' })
  @ApiResponse({ status: 400, description: 'Cannot override verification' })
  async overrideVerification(
    @Param('id') id: string,
    @Body() overrideDto: OverrideVerificationDto,
    @Request() req
  ) {
    return this.verificationsService.overrideVerification(
      id,
      overrideDto,
      req.user.id,
      req.user.tenantId
    );
  }

  @Post('philippines/philsys/pcn')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Verify PH PhilSys by PCN with face liveness' })
  @ApiResponse({ status: 200, description: 'Philsys verification executed' })
  async verifyPhilsysPcn(@Body() dto: PhilsysPcnDto, @Request() req) {
    return this.verificationsService.verifyPhilsysPcn(req.user.tenantId, dto);
  }
}

