import { IsString, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export enum UserType {
  SUPER_ADMIN = 'super_admin',
  TENANT_ADMIN = 'tenant_admin',
  TENANT_USER = 'tenant_user',
}

export class SearchUsersQueryDto {
  @ApiProperty({ 
    description: 'Search query to filter users by name or email',
    required: false,
    example: 'john@example.com'
  })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiProperty({ 
    description: 'Page number for pagination',
    required: false,
    default: 1,
    minimum: 1
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiProperty({ 
    description: 'Number of items per page',
    required: false,
    default: 10,
    minimum: 1
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @ApiProperty({ 
    description: 'Filter users by tenant ID',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiProperty({ 
    description: 'Include super admins in results',
    required: false,
    default: false
  })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  includeSuperAdmins?: boolean;

  @ApiProperty({ 
    description: 'Filter by user types (comma-separated: super_admin,tenant_admin,tenant_user)',
    required: false,
    example: 'tenant_admin,tenant_user',
    enum: UserType
  })
  @IsString()
  @IsOptional()
  userTypes?: string;
}

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiProperty({ description: 'User name' })
  name: string;

  @ApiProperty({ 
    description: 'User type',
    enum: UserType
  })
  user_type: UserType;

  @ApiProperty({ 
    description: 'User status',
    enum: ['active', 'inactive', 'suspended']
  })
  status: string;

  @ApiProperty({ description: 'Tenant ID (null for super admins)', nullable: true })
  tenant_id?: string;

  @ApiProperty({ description: 'Phone number', nullable: true })
  phone?: string;

  @ApiProperty({ description: 'Creation date' })
  created_at: Date;

  @ApiProperty({ description: 'Last update date' })
  updated_at: Date;

  @ApiProperty({ description: 'Tenant information', nullable: true })
  tenant?: {
    id: string;
    name: string;
    email: string;
  };
}

export class SearchUsersResponseDto {
  @ApiProperty({ 
    description: 'List of users',
    type: [UserResponseDto]
  })
  data: UserResponseDto[];

  @ApiProperty({ description: 'Total number of users matching the query' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Search query used' })
  query: string;
}

