import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class PhPrcDto {
  @ApiProperty({ description: 'Profession', example: 'Engineer' })
  @IsString()
  profession: string;

  @ApiProperty({ description: 'PRC license number (required if searching by license)', example: '123456', required: false })
  @IsString()
  @IsOptional()
  licenseNo?: string;

  @ApiProperty({ description: 'Date of birth (required if searching by license)', example: '1990-01-01', required: false })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ description: 'First name (required if searching by name)', example: 'Juan', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ description: 'Last name (required if searching by name)', example: 'DELA CRUZ', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ description: 'IDmeta template identifier', example: '425' })
  @IsString()
  templateId: string;

  @ApiProperty({ description: 'Existing verification id created via create-verification' })
  @IsString()
  verificationId: string;
}

