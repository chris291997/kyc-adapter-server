import { Controller, Post, Get, Put, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { VerificationsService } from './verifications.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { OverrideVerificationDto } from './dto/override-verification.dto';
import { PhilsysPcnDto } from './dto/philsys-pcn.dto';
import { DocumentVerificationDto } from './dto/document-verification.dto';
import { PhLtoDriversLicenseDto } from './dto/ph-lto-drivers-license.dto';
import { PhNationalPoliceDto } from './dto/ph-national-police.dto';
import { PhNbiDto } from './dto/ph-nbi.dto';
import { PhPrcDto } from './dto/ph-prc.dto';
import { PhSssDto } from './dto/ph-sss.dto';
import { BiometricsFaceMatchDto } from './dto/biometrics-face-match.dto';
import { BiometricsRegistrationDto } from './dto/biometrics-registration.dto';
import { BiometricVerificationDto } from './dto/biometric-verification.dto';
import { CustomDocumentDto } from './dto/custom-document.dto';
import { FinalizeVerificationDto } from './dto/finalize-verification.dto';
import { ManualFinalizeVerificationDto } from './dto/manual-finalize-verification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyAuthGuard } from '../auth/guards/api-key-auth.guard';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { TenantAuthGuard } from '../auth/guards/tenant-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@ApiTags('Verifications')
@Controller('verifications')
export class VerificationsController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
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
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
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

  @Get(':id/philsys-validate')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Server-side proxy for IDMeta PhilSys SDK validate-verification call',
    description:
      'Returns the eVerify publicKey for the given verification. The CLIENT uses this to drive the eVerify liveness SDK directly, bypassing the IDMeta SDK CORS restriction.',
  })
  @ApiResponse({ status: 200, description: 'PhilSys publicKey returned' })
  async validatePhilsysVerification(@Param('id') id: string, @Request() req) {
    return this.verificationsService.validatePhilsysVerification(req.user.tenantId, id);
  }

  @Post('philippines/lto/drivers-license')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Verify PH LTO Drivers License' })
  @ApiResponse({ status: 200, description: 'PH LTO Drivers License verification executed' })
  async verifyPhLtoDriversLicense(@Body() dto: PhLtoDriversLicenseDto, @Request() req) {
    return this.verificationsService.verifyPhLtoDriversLicense(req.user.tenantId, dto);
  }

  @Post('philippines/national-police')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Verify PH National Police Clearance' })
  @ApiResponse({ status: 200, description: 'PH National Police verification executed' })
  async verifyPhNationalPolice(@Body() dto: PhNationalPoliceDto, @Request() req) {
    return this.verificationsService.verifyPhNationalPolice(req.user.tenantId, dto);
  }

  @Post('philippines/nbi')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Verify PH NBI Clearance' })
  @ApiResponse({ status: 200, description: 'PH NBI verification executed' })
  async verifyPhNbi(@Body() dto: PhNbiDto, @Request() req) {
    return this.verificationsService.verifyPhNbi(req.user.tenantId, dto);
  }

  @Post('philippines/prc')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Verify PH PRC License' })
  @ApiResponse({ status: 200, description: 'PH PRC verification executed' })
  async verifyPhPrc(@Body() dto: PhPrcDto, @Request() req) {
    return this.verificationsService.verifyPhPrc(req.user.tenantId, dto);
  }

  @Post('philippines/sss')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Verify PH SSS Number' })
  @ApiResponse({ status: 200, description: 'PH SSS verification executed' })
  async verifyPhSss(@Body() dto: PhSssDto, @Request() req) {
    return this.verificationsService.verifyPhSss(req.user.tenantId, dto);
  }

  @Post('biometrics/face-match')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Biometrics Face Match - Compare two facial images' })
  @ApiResponse({ status: 200, description: 'Biometrics face match executed' })
  async biometricsFaceMatch(@Body() dto: BiometricsFaceMatchDto, @Request() req) {
    return this.verificationsService.biometricsFaceMatch(req.user.tenantId, dto);
  }

  @Post('biometrics/registration')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Biometrics Registration - Register user biometric data' })
  @ApiResponse({ status: 200, description: 'Biometrics registration executed' })
  async biometricsRegistration(@Body() dto: BiometricsRegistrationDto, @Request() req) {
    return this.verificationsService.biometricsRegistration(req.user.tenantId, dto);
  }

  @Post('biometrics/verification')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Biometric Verification - Authenticate identity through biometric liveness and facial recognition' })
  @ApiResponse({ status: 200, description: 'Biometric verification executed' })
  async biometricVerification(@Body() dto: BiometricVerificationDto, @Request() req) {
    return this.verificationsService.biometricVerification(req.user.tenantId, dto);
  }

  @Post('custom/document')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Custom Document Verification' })
  @ApiResponse({ status: 200, description: 'Custom document verification executed' })
  async customDocument(@Body() dto: CustomDocumentDto, @Request() req) {
    return this.verificationsService.customDocument(req.user.tenantId, dto);
  }

  @Post('finalize')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Finalize Verification - Evaluate all verification checks and set final status' })
  @ApiResponse({ status: 200, description: 'Verification finalized successfully' })
  async finalizeVerification(@Body() dto: FinalizeVerificationDto, @Request() req) {
    return this.verificationsService.finalizeVerification(req.user.tenantId, dto);
  }

  @Post('manual-finalize')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Manual Finalize Verification - Manually finalize a verification' })
  @ApiResponse({ status: 200, description: 'Verification manually finalized successfully' })
  async manualFinalizeVerification(@Body() dto: ManualFinalizeVerificationDto, @Request() req) {
    return this.verificationsService.manualFinalizeVerification(req.user.tenantId, dto);
  }
}

