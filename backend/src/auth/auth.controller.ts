import {
  Controller,
  Request,
  Post,
  UseGuards,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto'; // DTO for login request body
import { UserAccount, UserRole } from '../user-account/user-account.entity'; // For req.user type in login
import { JwtPayload } from './jwt.strategy'; // For req.user type in profile

// Define a type for the user object attached by LocalAuthGuard
interface AuthenticatedUser extends Omit<UserAccount, 'password'> {
  roles: UserRole[]; // Assuming roles are added by your validateUser or LocalStrategy
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Login endpoint.
   * Uses LocalAuthGuard to trigger LocalStrategy for username/password validation.
   * If successful, AuthService.login generates and returns a JWT.
   * @param req The request object, populated by LocalAuthGuard with the user property.
   * @param loginDto The login credentials from the request body (not strictly needed here as LocalAuthGuard handles it, but good for clarity/validation)
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK) // Ensure 200 OK on successful login
  login(
    @Request() req: { user: AuthenticatedUser },
    @Body() _loginDto: LoginDto, // Prefixed to indicate use by ValidationPipe only
  ) {
    // loginDto is validated by global ValidationPipe
    // req.user is populated by the LocalAuthGuard/LocalStrategy
    // after successful validation from validateUser in LocalStrategy
    return this.authService.login(req.user);
  }

  /**
   * Profile endpoint.
   * Protected by JwtAuthGuard, which uses JwtStrategy to validate the JWT.
   * If JWT is valid, request.user will be populated with the payload from JwtStrategy.validate.
   * @param req The request object, populated by JwtAuthGuard.
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: { user: JwtPayload }): JwtPayload {
    // req.user is populated by JwtStrategy.validate method
    return req.user;
  }

  // Note: User registration (creating a new user account) is typically handled by UserAccountController.
  // If you wanted a specific /auth/register endpoint, you would add it here,
  // likely calling UserAccountService.create.
}
