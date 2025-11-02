import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class BiometricsFaceMatchDto {
  @ApiProperty({ description: 'First image as base64 data URI (e.g., data:image/jpeg;base64,...)', example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...' })
  @IsString()
  @IsNotEmpty()
  image1: string;

  @ApiProperty({ description: 'Second image as base64 data URI for comparison', example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...' })
  @IsString()
  @IsNotEmpty()
  image2: string;

  @ApiProperty({ description: 'IDmeta template identifier', example: '425' })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: 'Existing verification id created via create-verification' })
  @IsString()
  @IsNotEmpty()
  verificationId: string;
}

