import { IsEmail, IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateTenantDto {
  @ApiProperty({ description: 'Tenant name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Tenant email address (will be used for first admin user)' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Password for the first admin user' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'Verification quota limit', default: 1000, required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => value || 1000)
  quotaLimit?: number;

  @ApiProperty({ 
    description: 'Tenant status', 
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    required: false 
  })
  @IsEnum(['active', 'inactive', 'suspended'])
  @IsOptional()
  status?: 'active' | 'inactive' | 'suspended';

  @ApiProperty({ description: 'First name of the tenant admin', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ description: 'Last name of the tenant admin', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ description: 'Mobile/phone number of the tenant admin', required: false })
  @IsString()
  @IsOptional()
  mobile?: string;
}

