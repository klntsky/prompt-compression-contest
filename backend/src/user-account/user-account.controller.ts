import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserAccountService } from './user-account.service';
import { CreateUserAccountDto } from './dto/create-user-account.dto';
import { UpdateUserAccountDto } from './dto/update-user-account.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './user-account.entity';
import { JwtPayload } from '../auth/jwt.strategy';

@Controller('user-accounts')
export class UserAccountController {
  constructor(private readonly userAccountService: UserAccountService) {}

  // Public endpoint for self-registration by default
  // If admin-only creation is needed, add: @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() createUserAccountDto: CreateUserAccountDto) {
    // The service now defaults roles to [UserRole.USER] if not provided
    return this.userAccountService.create(createUserAccountDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  async findAll() {
    return this.userAccountService.findAll();
  }

  @UseGuards(JwtAuthGuard) // Guard ensures user is logged in
  @Get(':username')
  async findOne(
    @Param('username') username: string,
    @Request() req: { user: JwtPayload },
  ) {
    // Service method now handles ForbiddenException if not owner and not admin
    return this.userAccountService.findOne(username, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':username')
  async update(
    @Param('username') username: string,
    @Body() updateUserAccountDto: UpdateUserAccountDto,
    @Request() req: { user: JwtPayload },
  ) {
    // Service method handles ForbiddenException and password/role update logic
    return this.userAccountService.update(
      username,
      updateUserAccountDto,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':username')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('username') username: string,
    @Request() req: { user: JwtPayload },
  ) {
    // Service method handles ForbiddenException
    return this.userAccountService.remove(username, req.user);
  }
}
