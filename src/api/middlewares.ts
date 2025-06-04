import { Request as ExpressRequest, Response, NextFunction } from 'express';
import rateLimit, {
  RateLimitRequestHandler,
  Options as RateLimitOptions,
} from 'express-rate-limit';

// --- Interfaces & Types ---

// Interface for the data added by express-rate-limit
export interface RateLimitData {
  limit: number;
  current: number;
  remaining: number;
  resetTime?: Date;
}

// This augments the Express.User type globally.
// It should align with what passport.deserializeUser provides.
// Consider moving this to a central types file (e.g., src/types/express.d.ts) if used across many files.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: string; // Typically the user's unique identifier (e.g., login or UUID)
      isAdmin?: boolean;
      // Add other properties here that you expect on req.user after authentication
    }
    // Define LogOutOptions if not available from @types/passport or @types/express
    interface LogOutOptions {
      keepSessionInfo?: boolean;
    }
  }
}

// For requests that have been authenticated and might have rate limit info
export interface AuthenticatedRequest extends ExpressRequest {
  user: Express.User;
  rateLimit?: RateLimitData;
}

// For requests that have rate limit info but are not necessarily authenticated
export interface RateLimitedRequest extends ExpressRequest {
  rateLimit?: RateLimitData; // From express-rate-limit
}

// --- Constants ---
export const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);

// --- Authentication Middlewares ---

/**
 * Middleware to ensure the user is authenticated.
 * If not authenticated, it typically redirects to /login or sends a 401/403 response.
 */
export const ensureAuthenticated = (
  req: ExpressRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).send('Unauthorized: Please log in.');
};

export const isAdminMiddleware = (
  req: ExpressRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).send('Unauthorized: Please log in.');
    return;
  }
  const authenticatedReq = req as AuthenticatedRequest;
  if (authenticatedReq.user && authenticatedReq.user.isAdmin) {
    next();
  } else {
    res.status(403).send('Forbidden: Admins only.');
  }
};

// --- Rate Limiters ---

// For successful registrations (IP-based)
export const successfulRegistrations = new Map<string, number>();

console.log(
  '[DEBUG] MIDDLEWARES.TS - Defining registrationLimiter - NEW LOG POINT'
);

export const registrationLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: 100, // General limit for the endpoint
  keyGenerator: (req: ExpressRequest) => {
    return req.ip || 'unknown-ip-general';
  },
  handler: async (
    req: ExpressRequest,
    res: Response,
    next: NextFunction,
    optionsUsed: RateLimitOptions
  ): Promise<void> => {
    const rateLimitedReq = req as RateLimitedRequest;
    const ip = req.ip;
    const currentSuccessful = ip ? successfulRegistrations.get(ip) || 0 : 0;
    // Custom logic for successful registration limit (2 per day)
    if (ip && currentSuccessful >= 2) {
      res
        .status(429)
        .send(
          'Too many successful registrations from this IP, please try again after 24 hours.'
        );
      return;
    }
    // General rate limiting from express-rate-limit (for the 'limit: 100' setting)
    if (
      rateLimitedReq.rateLimit &&
      rateLimitedReq.rateLimit.current >= (optionsUsed.limit as number)
    ) {
      res.status(optionsUsed.statusCode).send(optionsUsed.message);
      return;
    }
    next();
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// For attempts endpoint (user-based)
const attemptRateLimitKeyGenerator = (req: ExpressRequest) => {
  const authenticatedReq = req as AuthenticatedRequest;
  if (authenticatedReq.user && authenticatedReq.user.id) {
    return authenticatedReq.user.id; // Use user.id (login or other unique ID)
  }
  return req.ip || 'unknown-ip-attempts'; // Fallback to IP if user somehow not identified
};

export const attemptsLimiterPerHour: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: attemptRateLimitKeyGenerator,
  handler: (req, res, _next, options) => {
    res
      .status(options.statusCode)
      .send(
        `Too many attempts from this user, please try again after an hour. Limit: ${options.limit} per hour.`
      );
  },
});

export const attemptsLimiterPerDay: RateLimitRequestHandler = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 40,
  keyGenerator: attemptRateLimitKeyGenerator,
  handler: (req, res, _next, options) => {
    res
      .status(options.statusCode)
      .send(
        `Too many attempts from this user, please try again after a day. Limit: ${options.limit} per day.`
      );
  },
});
