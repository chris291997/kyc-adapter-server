import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PhilsysPcnDto {
  @ApiProperty({ description: 'PhilSys Card Number', example: '1234-5678-9123-4567' })
  @IsString()
  pcn: string;

  @ApiProperty({ description: 'Face liveness session id from IDmeta Liveness SDK' })
  @IsString()
  faceLivenessSessionId: string;

  @ApiProperty({ description: 'IDmeta template identifier', example: '425' })
  @IsString()
  templateId: string;

  @ApiProperty({ description: 'Existing verification id created via create-verification' })
  @IsString()
  verificationId: string;
}


