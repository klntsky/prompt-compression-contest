import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Add custom handling here if needed before super.canActivate
    return super.canActivate(context);
  }

  handleRequest<TUser extends JwtPayload = JwtPayload>(
    err: unknown,
    user: TUser | undefined,
    info: unknown,
    _context: ExecutionContext,
    _status?: unknown,
  ): TUser {
    if (err || !user) {
      let message = 'Unauthorized';
      if (info instanceof Error) {
        // info can be Error objects like TokenExpiredError, JsonWebTokenError
        if (info.name === 'TokenExpiredError') {
          message = 'Authentication token has expired. Please log in again.';
        } else if (info.name === 'JsonWebTokenError') {
          message = 'Authentication token is invalid. Please log in again.';
        } else {
          message = info.message || 'Invalid authentication token.';
        }
      } else if (typeof info === 'string') {
        message = info; // Use the string info if available
      } else if (!user && !err && !info) {
        message =
          'No authentication token provided. Please include a Bearer token in your Authorization header.';
      }
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException(message);
    }
    return user;
  }
}
