import { IsEmail, IsString, IsOptional, IsDateString, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class PersonNameDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  first?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  middle?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  last?: string;
}

class AddressDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  street?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  postalCode?: string;
}

export class CreateAccountDto {
  @ApiProperty({ description: 'Your internal reference ID for this user', required: false })
  @IsString()
  @IsOptional()
  reference_id?: string;

  @ApiProperty({ description: 'User full name', type: PersonNameDto, required: false })
  @IsObject()
  @ValidateNested()
  @Type(() => PersonNameDto)
  @IsOptional()
  name?: PersonNameDto;

  @ApiProperty({ description: 'User email address', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'User phone number', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'User date of birth (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  birthdate?: string;

  @ApiProperty({ description: 'User address', type: AddressDto, required: false })
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  address?: AddressDto;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}


