import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PhNbiDto {
  @ApiProperty({ description: 'NBI clearance number', example: 'N-1234567890-2024' })
  @IsString()
  clearanceNo: string;

  @ApiProperty({ description: 'IDmeta template identifier', example: '425' })
  @IsString()
  templateId: string;

  @ApiProperty({ description: 'Existing verification id created via create-verification' })
  @IsString()
  verificationId: string;
}

