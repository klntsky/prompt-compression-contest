import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserAccount } from '../user-account/user-account.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'username', // This refers to the field name in the login request body
      // passwordField: 'password' // Default is 'password', so can be omitted if field name is 'password'
    });
  }

  /**
   * Passport automatically calls this method with credentials from the request body.
   * @param username The username from the request.
   * @param password The password from the request.
   * @returns The user object if authentication is successful.
   * @throws UnauthorizedException if authentication fails.
   */
  async validate(
    username: string,
    password: string,
  ): Promise<Omit<UserAccount, 'password'>> {
    const user = await this.authService.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
