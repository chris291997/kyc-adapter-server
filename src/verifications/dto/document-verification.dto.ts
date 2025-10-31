import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DocumentVerificationDto {
  @ApiProperty({ description: 'Template ID from IDmeta trust flow' })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: 'Front image as base64 data URI (e.g., data:image/jpeg;base64,...)' })
  @IsString()
  @IsNotEmpty()
  imageFrontSide: string;

  @ApiPropertyOptional({ description: 'Back image as base64 data URI' })
  @IsString()
  @IsOptional()
  imageBackSide?: string;
}


