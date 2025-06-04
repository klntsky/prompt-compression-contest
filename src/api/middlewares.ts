import { Request as ExpressRequest, Response, NextFunction } from 'express';
import rateLimit, {
  RateLimitRequestHandler,
  Options as RateLimitOptions,
} from 'express-rate-limit';
import { expressjwt } from 'express-jwt';

// --- Interfaces & Types ---

// Interface for the data added by express-rate-limit
export interface RateLimitData {
  limit: number;
  current: number;
  remaining: number;
  resetTime?: Date;
}

export interface AuthPayload {
  userLogin: string;
  email: string;
  isAdmin: boolean;
  iat: number; // Issued At: Timestamp (seconds since epoch) when the token was issued
  exp: number; // Expiration Time: Timestamp (seconds since epoch) when the token expires
}

// For requests that have been authenticated and might have rate limit info
export interface AuthenticatedRequest extends ExpressRequest {
  auth: AuthPayload; // Properties from the decoded JWT - now non-optional
  rateLimit?: RateLimitData; // From express-rate-limit
}

// For requests that have rate limit info but are not necessarily authenticated
export interface RateLimitedRequest extends ExpressRequest {
  rateLimit?: RateLimitData; // From express-rate-limit
}

// --- Constants ---
const jwtSecretFromEnv = process.env.JWT_SECRET;
if (!jwtSecretFromEnv) {
  console.error(
    'FATAL ERROR: JWT_SECRET environment variable is not set. Application will terminate.'
  );
  process.exit(1); // Exit the application if JWT_SECRET is not set
}
export const JWT_SECRET = jwtSecretFromEnv;

export const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);

// --- Authentication Middlewares ---
export const authenticateToken = expressjwt({
  secret: JWT_SECRET,
  algorithms: ['HS256'],
});

export const isAdminMiddleware = (
  req: ExpressRequest,
  res: Response,
  next: NextFunction
): void => {
  const authenticatedReq = req as AuthenticatedRequest;
  if (!authenticatedReq.auth || !authenticatedReq.auth.isAdmin) {
    res.status(403).send('Forbidden: Admins only.');
    return;
  }
  next();
};

// --- Rate Limiters ---

// For successful registrations (IP-based)
export const successfulRegistrations = new Map<string, number>();

export const registrationLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  handler: async (
    req: RateLimitedRequest,
    res: Response,
    next: NextFunction,
    optionsUsed: RateLimitOptions
  ): Promise<void> => {
    const ip = req.ip;
    if (ip && (successfulRegistrations.get(ip) || 0) >= 2) {
      res
        .status(429)
        .send(
          'Too many successful registrations from this IP, please try again after 24 hours.'
        );
      return;
    }
    const limit = optionsUsed.limit as number;
    if (req.rateLimit && req.rateLimit.current >= limit) {
      res.status(optionsUsed.statusCode).send(optionsUsed.message);
      return;
    }
    next();
  },
  keyGenerator: (req: ExpressRequest) => {
    return req.ip || 'unknown-ip';
  },
  limit: 100, // General attempts for registration endpoint
});

// For attempts endpoint (user-based)
const attemptRateLimitKeyGenerator = (req: ExpressRequest) => {
  const authenticatedReq = req as AuthenticatedRequest;
  if (authenticatedReq.auth && authenticatedReq.auth.userLogin) {
    return authenticatedReq.auth.userLogin;
  }
  // Fallback, though this route should be protected and req.auth present
  return req.ip || 'unknown-ip';
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
