import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserAccountService } from '../user-account/user-account.service'; // To potentially fetch full user object
import { UserRole } from '../user-account/user-account.entity'; // Added UserRole import

// Define the structure of the JWT payload
export interface JwtPayload {
  username: string;
  sub: string; // Standard claim for subject (user identifier)
  roles: UserRole[]; // Added roles
  // Add any other fields you put into the JWT payload during login (e.g., roles)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userAccountService: UserAccountService, // Optional: if you need to fetch fresh user data
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'YOUR_DEFAULT_VERY_SECRET_KEY_32_CHARS_LONG',
      ),
    });
  }

  /**
   * Passport automatically calls this method after verifying the JWT signature and expiration.
   * @param payload The decoded JWT payload (as defined in AuthService login method).
   * @returns The user object or payload to be attached to request.user.
   */
  validate(payload: JwtPayload): JwtPayload {
    // Returning the payload directly as it contains all needed info (username, roles, sub)
    return {
      sub: payload.sub,
      username: payload.username,
      roles: payload.roles,
    };
  }
}
