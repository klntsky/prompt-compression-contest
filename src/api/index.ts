import 'reflect-metadata';

// Explicitly import entity modules to help resolve circular dependencies
// for decorator metadata, before AppDataSource or other entity users.
import './entities/user.js';
import './entities/attempt.js';
import './entities/test.js';
import './entities/test-result.js';

import AppDataSource from './data-source.js';
import express, {
  Request as ExpressRequest,
  Response,
  NextFunction,
} from 'express';

// Import routers
import authRouter, { seedAdminUser } from './routes/auth.routes.js';
import attemptRouter from './routes/attempt.routes.js';
import testRouter from './routes/test.routes.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Mount routers
// Public auth routes (e.g., /register, /login)
app.use('/auth', authRouter);
// API routes (protected, require authentication)
app.use('/api/attempts', attemptRouter);
app.use('/api/tests', testRouter);

// Interface for JWT UnauthorizedError
interface UnauthorizedError extends Error {
  status?: number;
}

// General Error Handler for JWT UnauthorizedError
app.use(
  (
    err: UnauthorizedError,
    req: ExpressRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (err.name === 'UnauthorizedError') {
      res
        .status(err.status || 401)
        .send(err.message || 'Invalid or expired token.');
    } else {
      next(err);
    }
  }
);

const PORT = parseInt(process.env.PORT || '3000', 10);

AppDataSource.initialize()
  .then(async () => {
    console.log('Data Source has been initialized!');
    await seedAdminUser();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error('Error during Data Source initialization:', error);
    app.listen(PORT, () => {
      console.log(
        `Server is running on port ${PORT}, but DB connection/admin seeding might have failed.`
      );
    });
  });

// Final general error handler
app.use(
  (err: Error, req: ExpressRequest, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).send('Something broke!');
  }
);
