import 'reflect-metadata';
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
import session from 'express-session';
import passport from 'passport';
import flash from 'connect-flash';
import authRouter, { seedAdminUser } from './routes/auth.routes.js';
import attemptRouter from './routes/attempt.routes.js';
import testRouter from './routes/test.routes.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration
const sessionSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error(
    'FATAL ERROR: JWT_SECRET or SESSION_SECRET environment variable for session is not set. Application will terminate.'
  );
  process.exit(1);
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Mount routers
// Public auth routes (e.g., /register, /login)
app.use('/auth', authRouter);
// API routes (protected, require authentication)
app.use('/api/attempts', attemptRouter);
app.use('/api/tests', testRouter);

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
    const errorMessage =
      process.env.NODE_ENV === 'production' ? 'Something broke!' : err.message;
    res.status(500).send(errorMessage);
  }
);
