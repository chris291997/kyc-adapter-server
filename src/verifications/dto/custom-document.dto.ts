import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CustomDocumentDto {
  @ApiPropertyOptional({ description: 'Document as base64 data URI (e.g., data:image/png;base64,...)', example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...==' })
  @IsString()
  @IsOptional()
  document?: string;

  @ApiProperty({ description: 'IDmeta template identifier', example: '425' })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: 'Existing verification id created via create-verification' })
  @IsString()
  @IsNotEmpty()
  verificationId: string;
}

