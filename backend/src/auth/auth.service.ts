import { Injectable } from '@nestjs/common';
import { UserAccountService } from '../user-account/user-account.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserAccount, UserRole } from '../user-account/user-account.entity';

@Injectable()
export class AuthService {
  constructor(
    private userAccountService: UserAccountService,
    private jwtService: JwtService,
  ) {}

  /**
   * Validates a user based on username and password.
   * @param username The user's username.
   * @param pass The user's plain text password.
   * @returns The user object if validation is successful, otherwise null.
   */
  async validateUser(
    username: string,
    pass: string,
  ): Promise<Omit<UserAccount, 'password'> | null> {
    const user = await this.userAccountService.findOne(username);
    if (user && (await bcrypt.compare(pass, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Logs in a user and returns a JWT access token.
   * @param user The user object (typically after validation, should include roles).
   * @returns An object containing the access_token.
   */
  login(user: Omit<UserAccount, 'password'> & { roles: UserRole[] }) {
    const payload = {
      username: user.username,
      sub: user.username,
      roles: user.roles,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
