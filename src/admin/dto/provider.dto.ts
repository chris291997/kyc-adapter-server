import { IsString, IsEnum, IsBoolean, IsObject, IsOptional, IsUrl, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ProviderType {
  SINGLE_STEP = 'single_step',
  MULTI_STEP = 'multi_step',
  ASYNC_WEBHOOK = 'async_webhook',
}

export class CreateProviderDto {
  @ApiProperty({ 
    description: 'Provider name (must be unique)', 
    example: 'IDmeta',
    minLength: 2,
    maxLength: 50
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ 
    description: 'Provider type', 
    enum: ProviderType,
    example: ProviderType.MULTI_STEP,
    required: false
  })
  @IsOptional()
  @IsEnum(ProviderType)
  type?: ProviderType;

  @ApiProperty({ 
    description: 'Provider base URL', 
    example: 'https://api.idmeta.com'
  })
  @IsUrl({}, { message: 'base_url must be a valid URL' })
  base_url: string;

  @ApiProperty({ 
    description: 'API version', 
    example: 'v1',
    minLength: 1,
    maxLength: 10,
    required: false
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  api_version?: string;

  // Centralized credentials (super admin only)
  @ApiProperty({ 
    description: 'Provider API key (centralized credential)', 
    example: 'pk_live_123456789',
    required: false
  })
  @IsOptional()
  @IsString()
  api_key?: string;

  @ApiProperty({ 
    description: 'Provider secret key (centralized credential)', 
    example: 'sk_live_987654321',
    required: false
  })
  @IsOptional()
  @IsString()
  secret_key?: string;

  @ApiProperty({ 
    description: 'Webhook secret HMAC (for verifying provider webhook signatures)', 
    example: 'whsec_a1b2c3d4e5f6...',
    required: false
  })
  @IsOptional()
  @IsString()
  webhook_secret?: string;

  @ApiProperty({ 
    description: 'Whether provider supports webhooks', 
    required: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  supports_webhooks?: boolean = false;

  @ApiProperty({ 
    description: 'Whether provider supports multi-step verification', 
    required: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  supports_multi_step?: boolean = false;

  @ApiProperty({ 
    description: 'Whether provider supports hosted workflow', 
    required: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  supports_hosted_workflow?: boolean = false;

  @ApiProperty({ 
    description: 'Provider configuration (timeouts, retries, etc.)', 
    required: false,
    example: { timeout: 30000, retryAttempts: 3 }
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any> = {};

  @ApiProperty({ 
    description: 'Whether provider should be active', 
    required: false,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  // Legacy field name (also support is_active for backward compatibility)
  @ApiProperty({ 
    description: 'Whether provider should be active (legacy field)', 
    required: false,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}

export class UpdateProviderDto {
  @ApiProperty({ 
    description: 'Provider name (must be unique)', 
    required: false,
    example: 'IDmeta Updated',
    minLength: 2,
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiProperty({ 
    description: 'Provider type', 
    enum: ProviderType,
    required: false
  })
  @IsOptional()
  @IsEnum(ProviderType)
  type?: ProviderType;

  @ApiProperty({ 
    description: 'API version', 
    required: false,
    example: 'v2',
    minLength: 1,
    maxLength: 10
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  api_version?: string;

  @ApiProperty({ 
    description: 'Provider base URL', 
    required: false,
    example: 'https://api-v2.idmeta.com'
  })
  @IsOptional()
  @IsUrl({}, { message: 'base_url must be a valid URL' })
  base_url?: string;

  @ApiProperty({ 
    description: 'Provider API key (centralized credential)', 
    required: false,
    example: 'pk_live_123456789'
  })
  @IsOptional()
  @IsString()
  api_key?: string;

  @ApiProperty({ 
    description: 'Provider secret key (centralized credential)', 
    required: false,
    example: 'sk_live_987654321'
  })
  @IsOptional()
  @IsString()
  secret_key?: string;

  @ApiProperty({ 
    description: 'Webhook secret HMAC (for verifying provider webhook signatures)', 
    required: false,
    example: 'whsec_a1b2c3d4e5f6...'
  })
  @IsOptional()
  @IsString()
  webhook_secret?: string;

  @ApiProperty({ 
    description: 'Whether provider supports webhooks', 
    required: false
  })
  @IsOptional()
  @IsBoolean()
  supports_webhooks?: boolean;

  @ApiProperty({ 
    description: 'Whether provider supports multi-step verification', 
    required: false
  })
  @IsOptional()
  @IsBoolean()
  supports_multi_step?: boolean;

  @ApiProperty({ 
    description: 'Whether provider supports hosted workflow', 
    required: false
  })
  @IsOptional()
  @IsBoolean()
  supports_hosted_workflow?: boolean;

  @ApiProperty({ 
    description: 'Provider configuration (timeouts, retries, etc.)', 
    required: false,
    example: { timeout: 45000, retryAttempts: 5 }
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiProperty({ 
    description: 'Whether provider should be active', 
    required: false
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateProviderStatusDto {
  @ApiProperty({ 
    description: 'Provider status', 
    example: true
  })
  @IsBoolean()
  is_active: boolean;
}

export class ProviderTestResponseDto {
  @ApiProperty({ description: 'Test result' })
  success: boolean;

  @ApiProperty({ description: 'Test message' })
  message: string;

  @ApiProperty({ description: 'Response time in milliseconds', required: false })
  responseTime?: number;

  @ApiProperty({ description: 'Error details if test failed', required: false })
  error?: string;
}
