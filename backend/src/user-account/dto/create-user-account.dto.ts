import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsOptional,
  IsArray,
  IsEnum,
} from 'class-validator';
import { UserRole } from '../user-account.entity'; // Import UserRole

export class CreateUserAccountDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  username!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password!: string;

  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];
}
