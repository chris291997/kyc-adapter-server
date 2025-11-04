import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ManualFinalizeVerificationDto {
  @ApiProperty({ description: 'Template ID from IDmeta trust flow' })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: 'Verification ID to manually finalize' })
  @IsString()
  @IsNotEmpty()
  verificationId: string;
}

