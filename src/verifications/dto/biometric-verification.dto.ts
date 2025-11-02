import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class BiometricVerificationDto {
  @ApiProperty({ description: 'Image as base64 data URI (e.g., data:image/jpeg;base64,...)', example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...' })
  @IsString()
  @IsNotEmpty()
  image: string;

  @ApiPropertyOptional({ description: 'Base64 encoded image (alternative to image)', example: 'dGVzdGltYWdlYmFzZTY0' })
  @IsString()
  @IsOptional()
  imageBase64?: string;

  @ApiProperty({ description: 'IDmeta template identifier', example: '425' })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: 'Existing verification id created via create-verification' })
  @IsString()
  @IsNotEmpty()
  verificationId: string;
}

