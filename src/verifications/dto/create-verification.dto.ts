import { IsString, IsEmail, IsOptional, IsObject, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVerificationDto {
  @ApiProperty({ description: 'Account ID to verify', required: false })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiProperty({ example: 'document', required: false })
  @IsOptional()
  @IsString()
  verificationType?: string;

  @ApiProperty({ example: 'user@example.com', required: false })
  @IsOptional()
  @IsEmail()
  userEmail?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  userPhone?: string;

  @ApiProperty({ 
    example: { userId: 'user-123', sessionId: 'session-456' },
    required: false 
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ example: '426', required: false })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ 
    example: 'https://your-app.com/webhook',
    required: false 
  })
  @IsOptional()
  @IsString()
  callbackUrl?: string;
}

