import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './decorators/roles.decorator';
import { UserRole } from '../user-account/user-account.entity'; // Adjust path as needed
import { JwtPayload } from './jwt.strategy'; // For typing user

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No specific roles required, access granted
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user || !user.roles) {
      // This should ideally be caught by JwtAuthGuard first, but as a safeguard:
      throw new ForbiddenException(
        'Access denied. User information or roles not available. Ensure you are authenticated.',
      );
    }

    const hasRequiredRole = requiredRoles.some((role) =>
      user.roles?.includes(role),
    );

    if (hasRequiredRole) {
      return true;
    }

    throw new ForbiddenException(
      `Access denied. User does not have the required roles: ${requiredRoles.join(', ')}. User roles: ${user.roles.join(', ')}.`,
    );
  }
}
