import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class BiometricsRegistrationDto {
  @ApiProperty({ description: 'Username of person being registered', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'Image as base64 data URI (e.g., data:image/jpeg;base64,...)', example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...' })
  @IsString()
  @IsNotEmpty()
  image: string;

  @ApiProperty({ description: 'IDmeta template identifier', example: '425' })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: 'Existing verification id created via create-verification' })
  @IsString()
  @IsNotEmpty()
  verificationId: string;
}

