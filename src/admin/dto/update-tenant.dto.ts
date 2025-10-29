import { IsEmail, IsString, IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTenantDto {
  @ApiProperty({ description: 'Tenant name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Tenant email address', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Verification quota limit', required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  quota_limit?: number;
}

export class UpdateTenantStatusDto {
  @ApiProperty({ description: 'Tenant status', enum: ['active', 'inactive', 'suspended'] })
  @IsEnum(['active', 'inactive', 'suspended'])
  status: 'active' | 'inactive' | 'suspended';
}

export class UpdateTenantQuotaDto {
  @ApiProperty({ description: 'New quota limit' })
  @IsInt()
  @Min(0)
  quota_limit: number;

  @ApiProperty({ description: 'Reset quota used to 0', default: false })
  @IsOptional()
  reset_used?: boolean;
}


