import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PhNationalPoliceDto {
  @ApiProperty({ description: 'Surname', example: 'DELA CRUZ' })
  @IsString()
  surname: string;

  @ApiProperty({ description: 'Clearance number', example: 'NP-123456-2024' })
  @IsString()
  clearanceNo: string;

  @ApiProperty({ description: 'IDmeta template identifier', example: '425' })
  @IsString()
  templateId: string;

  @ApiProperty({ description: 'Existing verification id created via create-verification' })
  @IsString()
  verificationId: string;
}

