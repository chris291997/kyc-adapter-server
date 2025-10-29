import { IsUUID, IsObject, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantProviderConfigDto {
  @ApiProperty({ description: 'Provider ID' })
  @IsUUID()
  provider_id: string;

  @ApiProperty({ description: 'Provider configuration (API keys, settings, etc.)', required: false })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiProperty({ description: 'Priority order (1 = highest)', required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  priority?: number = 1;

  @ApiProperty({ description: 'Whether this provider is enabled', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean = true;
}

export class UpdateTenantProviderConfigDto {
  @ApiProperty({ description: 'Provider configuration (API keys, settings, etc.)', required: false })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiProperty({ description: 'Priority order (1 = highest)', required: false })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiProperty({ description: 'Whether this provider is enabled', required: false })
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;
}

