import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PhSssDto {
  @ApiProperty({ description: 'SSS CRN/SS Number', example: '34-1234567-8' })
  @IsString()
  crnSsNumber: string;

  @ApiProperty({ description: 'IDmeta template identifier', example: '425' })
  @IsString()
  templateId: string;

  @ApiProperty({ description: 'Existing verification id created via create-verification' })
  @IsString()
  verificationId: string;
}

