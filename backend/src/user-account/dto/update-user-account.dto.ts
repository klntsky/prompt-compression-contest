import { PartialType } from '@nestjs/mapped-types';
import { CreateUserAccountDto } from './create-user-account.dto';
import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsArray,
  IsEnum,
} from 'class-validator';
import { UserRole } from '../user-account.entity';

export class UpdateUserAccountDto extends PartialType(CreateUserAccountDto) {
  // Username, email, and password will be optional due to PartialType.
  // We can add more specific rules or @IsOptional() explicitly if needed,
  // but PartialType usually handles making them optional for validation.

  // For example, if you allow username to be updated:
  @IsOptional()
  @IsString()
  @MinLength(1)
  username?: string;

  // If you allow email to be updated:
  @IsOptional()
  @IsEmail()
  email?: string;

  // Password can be updated by an admin. Field is optional.
  // For regular users, a dedicated change password flow is recommended.
  @IsOptional()
  @IsString()
  @MinLength(4) // Keep consistency with create DTO if password is provided
  password?: string;

  // Roles can be updated by an admin. Field is optional.
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];
}
