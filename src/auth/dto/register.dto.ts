import { IsEmail, IsString, IsEnum, MinLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: ['super_admin', 'tenant_admin', 'tenant_user'], example: 'tenant_user' })
  @IsEnum(['super_admin', 'tenant_admin', 'tenant_user'])
  userType: 'super_admin' | 'tenant_admin' | 'tenant_user';

  @ApiProperty({ description: 'Tenant ID (required for tenant_admin and tenant_user)', required: false })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

