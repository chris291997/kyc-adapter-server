import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FinalizeVerificationDto {
  @ApiProperty({ description: 'Template ID from IDmeta trust flow' })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: 'Verification ID to finalize' })
  @IsString()
  @IsNotEmpty()
  verificationId: string;
}

