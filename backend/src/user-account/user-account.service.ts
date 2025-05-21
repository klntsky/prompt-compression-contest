import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAccount, UserRole } from './user-account.entity';
import { CreateUserAccountDto } from './dto/create-user-account.dto';
import { UpdateUserAccountDto } from './dto/update-user-account.dto';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../auth/jwt.strategy';

const SALT_ROUNDS = 10; // Or use a value from ConfigService

@Injectable()
export class UserAccountService {
  constructor(
    @InjectRepository(UserAccount)
    private readonly userRepository: Repository<UserAccount>,
  ) {}

  async create(
    createUserAccountDto: CreateUserAccountDto,
  ): Promise<UserAccount> {
    const existingUserByUsername = await this.userRepository.findOne({
      where: { username: createUserAccountDto.username },
    });
    if (existingUserByUsername) {
      throw new ConflictException(
        `User with username "${createUserAccountDto.username}" already exists.`,
      );
    }
    // It's also good practice to check for existing email if it should be unique
    const existingUserByEmail = await this.userRepository.findOne({
      where: { email: createUserAccountDto.email },
    });
    if (existingUserByEmail) {
      throw new ConflictException(
        `User with email "${createUserAccountDto.email}" already exists.`,
      );
    }

    const hashedPassword: string = await bcrypt.hash(
      createUserAccountDto.password,
      SALT_ROUNDS,
    );

    const newUserAccount = this.userRepository.create({
      ...createUserAccountDto,
      password: hashedPassword,
      roles: createUserAccountDto.roles || [UserRole.USER],
    });
    return this.userRepository.save(newUserAccount);
  }

  async findAll(): Promise<UserAccount[]> {
    return this.userRepository.find();
  }

  async findOne(
    username: string,
    currentUser?: JwtPayload,
  ): Promise<UserAccount> {
    if (
      currentUser &&
      !currentUser.roles.includes(UserRole.ADMIN) &&
      username !== currentUser.username
    ) {
      throw new ForbiddenException(
        'You are not authorized to view this user account.',
      );
    }
    const userAccount = await this.userRepository.findOne({
      where: { username },
    });
    if (!userAccount) {
      throw new NotFoundException(
        `UserAccount with username "${username}" not found`,
      );
    }
    return userAccount;
  }

  // findByUsername is effectively the same as findOne now, so it can be removed or kept as an alias
  // For clarity, let's keep findOne as the primary method for fetching by PK.
  // async findByUsername(username: string): Promise<UserAccount | undefined> {
  //   return this.userRepository.findOne({ where: { username } });
  // }

  async update(
    username: string,
    updateUserAccountDto: UpdateUserAccountDto,
    currentUser: JwtPayload,
  ): Promise<UserAccount> {
    if (
      !currentUser.roles.includes(UserRole.ADMIN) &&
      username !== currentUser.username
    ) {
      throw new ForbiddenException(
        'You are not authorized to update this user account.',
      );
    }

    const userAccount = await this.userRepository.findOne({
      where: { username },
    });
    if (!userAccount) {
      throw new NotFoundException(
        `UserAccount with username "${username}" not found`,
      );
    }

    if (updateUserAccountDto.password) {
      if (!currentUser.roles.includes(UserRole.ADMIN)) {
        throw new ForbiddenException(
          'Password updates must go through the dedicated change password process.',
        );
      }
      // Ensure password is a string before hashing, though the DTO and if condition should ensure this.
      const passwordToHash: string = updateUserAccountDto.password;
      updateUserAccountDto.password = await bcrypt.hash(
        passwordToHash,
        SALT_ROUNDS,
      ); // bcrypt.hash returns Promise<string>
    } else {
      delete updateUserAccountDto.password;
    }

    // Prevent non-admins from changing roles
    if (
      updateUserAccountDto.roles &&
      !currentUser.roles.includes(UserRole.ADMIN)
    ) {
      delete updateUserAccountDto.roles; // Or throw ForbiddenException
    }

    this.userRepository.merge(userAccount, updateUserAccountDto);
    return this.userRepository.save(userAccount);
  }

  async remove(username: string, currentUser: JwtPayload): Promise<void> {
    if (
      !currentUser.roles.includes(UserRole.ADMIN) &&
      username !== currentUser.username
    ) {
      throw new ForbiddenException(
        'You are not authorized to delete this user account.',
      );
    }

    const userAccount = await this.userRepository.findOne({
      where: { username },
    });
    if (!userAccount) {
      throw new NotFoundException(
        `UserAccount with username "${username}" not found`,
      );
    }
    // Prevent users from deleting themselves if they are the last admin? (More complex rule, skip for now)

    const result = await this.userRepository.delete(username);
    if (result.affected === 0) {
      // Should be caught by the findOne check above, but as a safeguard
      throw new NotFoundException(
        `UserAccount with username "${username}" not found or already deleted.`,
      );
    }
  }
}
