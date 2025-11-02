import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PhLtoDriversLicenseDto {
  @ApiProperty({ description: 'Driver license number', example: 'N01-12-345678' })
  @IsString()
  licenseNo: string;

  @ApiProperty({ description: 'IDmeta template identifier', example: '425' })
  @IsString()
  templateId: string;

  @ApiProperty({ description: 'Existing verification id created via create-verification' })
  @IsString()
  verificationId: string;
}

