import { IsString, IsEnum, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OverrideVerificationDto {
  @ApiProperty({ 
    enum: ['approved', 'rejected'],
    example: 'approved'
  })
  @IsEnum(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @ApiProperty({ 
    example: 'Customer provided additional proof via phone call',
    description: 'Reason for the override decision'
  })
  @IsString()
  @MinLength(10)
  reason: string;
}


