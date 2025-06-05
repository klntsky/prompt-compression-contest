import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

// --- Interfaces & Types ---

// Interface for the data added by express-rate-limit
export interface RateLimitData {
  limit: number;
  current: number;
  remaining: number;
  resetTime?: Date;
}

// For requests that have been authenticated and might have rate limit info
export interface AuthenticatedRequest extends Request {
  user: Express.User;
  rateLimit?: RateLimitData;
}

// For requests that have rate limit info but are not necessarily authenticated
export interface RateLimitedRequest extends Request {
  rateLimit?: RateLimitData; // From express-rate-limit
}

// --- Constants ---
export const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);

// --- Authentication Middlewares ---

/**
 * Middleware to check if the user is authenticated.
 * If not, it redirects to the login page or sends a 401 error.
 * @param req - Express request object.
 */
export const ensureAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).send('Unauthorized: Please log in.');
};

export const isAdminMiddleware = (
  req: Request,
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

const REGISTRATIONS_PER_DAY_LIMIT = parseInt(
  process.env.REGISTRATIONS_PER_DAY_LIMIT || '2',
  10
);

export const registrationLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 86400000, // 24 hours in ms
  // limit is handled by custom logic below, not a general request limit.
  keyGenerator: (req: Request) => {
    return req.ip || 'unknown-ip-general';
  },
  handler: async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const ip = req.ip;
    const currentSuccessful = ip ? successfulRegistrations.get(ip) || 0 : 0;
    // Custom logic for successful registration limit
    if (ip && currentSuccessful >= REGISTRATIONS_PER_DAY_LIMIT) {
      res
        .status(429)
        .send(
          `Too many successful registrations from this IP, please try again after 24 hours. Limit: ${REGISTRATIONS_PER_DAY_LIMIT} per day.`
        );
      return;
    }
    // General rate limiting from express-rate-limit is removed.
    next();
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// For attempts endpoint (user-based)
const attemptRateLimitKeyGenerator = (req: Request) => {
  const authenticatedReq = req as AuthenticatedRequest;
  if (authenticatedReq.user && authenticatedReq.user.id) {
    return authenticatedReq.user.id; // Use user.id (login or other unique ID)
  }
  return req.ip || 'unknown-ip-attempts'; // Fallback to IP if user somehow not identified
};

const ATTEMPTS_PER_HOUR_LIMIT = parseInt(
  process.env.ATTEMPTS_PER_HOUR_LIMIT || '10',
  10
);

export const attemptsLimiterPerHour: RateLimitRequestHandler = rateLimit({
  windowMs: 3600000, // 1 hour in ms
  limit: ATTEMPTS_PER_HOUR_LIMIT,
  keyGenerator: attemptRateLimitKeyGenerator,
  handler: (req, res, _next, options) => {
    res
      .status(options.statusCode)
      .send(
        `Too many attempts from this user, please try again after an hour. Limit: ${ATTEMPTS_PER_HOUR_LIMIT} per hour.`
      );
  },
});

const ATTEMPTS_PER_DAY_LIMIT = parseInt(
  process.env.ATTEMPTS_PER_DAY_LIMIT || '40',
  10
);

export const attemptsLimiterPerDay: RateLimitRequestHandler = rateLimit({
  windowMs: 86400000, // 24 hours in ms
  limit: ATTEMPTS_PER_DAY_LIMIT,
  keyGenerator: attemptRateLimitKeyGenerator,
  handler: (req, res, _next, options) => {
    res
      .status(options.statusCode)
      .send(
        `Too many attempts from this user, please try again after a day. Limit: ${ATTEMPTS_PER_DAY_LIMIT} per day.`
      );
  },
});
