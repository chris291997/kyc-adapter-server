import { IsString, IsArray, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Production API Key' })
  @IsString()
  name: string;

  @ApiProperty({ 
    example: ['verifications:read', 'verifications:write', 'webhooks:manage'],
    description: 'Array of permission scopes',
    required: false
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopes?: string[];

  @ApiProperty({ 
    example: '2025-12-31T23:59:59Z',
    description: 'Optional expiration date (ISO string)',
    required: false
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({ 
    example: 365,
    description: 'Optional expiration in days from now',
    required: false
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  expires_in_days?: number;
}

