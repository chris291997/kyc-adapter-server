import { IsString, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadDocumentDto {
  @ApiProperty({ 
    enum: [
      'id_front', 
      'id_back', 
      'passport', 
      'drivers_license_front', 
      'drivers_license_back', 
      'selfie', 
      'proof_of_address'
    ],
    example: 'id_front'
  })
  @IsEnum([
    'id_front', 
    'id_back', 
    'passport', 
    'drivers_license_front', 
    'drivers_license_back', 
    'selfie', 
    'proof_of_address'
  ])
  documentType: string;

  @ApiProperty({ example: 'https://s3.amazonaws.com/bucket/file.jpg' })
  @IsString()
  fileUrl: string;

  @ApiProperty({ example: 1024000 })
  @IsNumber()
  fileSize: number;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  mimeType: string;
}


