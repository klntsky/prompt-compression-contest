import { Request, Response, NextFunction, Router } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy, IVerifyOptions } from 'passport-local';
import bcrypt from 'bcrypt';
import zxcvbn from 'zxcvbn';
import validator from 'validator';
import { SALT_ROUNDS } from '../middlewares.js';
import AppDataSource from '../data-source.js';
import { User } from '../entities/user.js';

// Define interfaces for request payloads
interface RegistrationPayload {
  username?: string;
  email?: string;
  password?: string;
}

const router = Router();

const successfulRegistrationsLocal = new Map<string, number>();

passport.use(
  new LocalStrategy(
    async (
      username,
      password,
      done: (
        error: unknown,
        user?: Express.User | false, // Express.User should pick up the global definition
        options?: IVerifyOptions
      ) => void
    ) => {
      const userRepository = AppDataSource.getRepository(User);
      try {
        const userEntity = await userRepository.findOneBy({ login: username });
        if (!userEntity) {
          return done(null, false, {
            message: 'Incorrect username or password.',
          });
        }
        const match = await bcrypt.compare(password, userEntity.password);
        if (match) {
          // Populate Express.User with id and isAdmin
          return done(null, {
            id: userEntity.login,
            isAdmin: userEntity.isAdmin,
          });
        } else {
          return done(null, false, {
            message: 'Incorrect username or password.',
          });
        }
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user: Express.User, done) => {
  // user object here is { id: string, isAdmin: boolean } from LocalStrategy
  done(null, user.id); // Only user.id (login) is stored in the session
});

passport.deserializeUser(async (id: string, done) => {
  // id is the user.id (login) from the session
  const userRepository = AppDataSource.getRepository(User);
  try {
    const userEntity = await userRepository.findOneBy({ login: id });
    if (userEntity) {
      // Reconstruct the Express.User object for req.user
      done(null, { id: userEntity.login, isAdmin: userEntity.isAdmin });
    } else {
      done(null, false); // User not found
    }
  } catch (err) {
    done(err);
  }
});

// Registration route
router.get('/register', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'GET /register - serves registration form (not used by API tests)',
  });
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  // NEW: Inline rate limiting logic using the local map
  const ip = req.ip;
  const currentSuccessfulOnLocalMap = ip
    ? successfulRegistrationsLocal.get(ip) || 0
    : 0;
  if (ip && currentSuccessfulOnLocalMap >= 2) {
    res.status(429).json({
      error:
        'Too many successful registrations from this IP (local inline check), please try again after 24 hours.',
      limit_details: {
        ip: ip,
        attempted_at: new Date().toISOString(),
        count_before_this_attempt: currentSuccessfulOnLocalMap,
      },
    });
    return;
  }

  const userRepository = AppDataSource.getRepository(User);
  try {
    const { username, email, password } = req.body as RegistrationPayload;

    if (!username || !password || !email) {
      res.status(400).json({
        error: 'Username, email, and password are required.',
      });
      return;
    }
    const error = await validateRegistration(
      username,
      email,
      password,
      userRepository
    );
    if (error) {
      res.status(400).json({
        error: error,
      });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = userRepository.create({
      login: username,
      email: email,
      password: hashedPassword,
      isAdmin: false,
    });
    await userRepository.save(newUser);

    // Update the LOCAL map after successful registration
    if (ip) {
      const count = successfulRegistrationsLocal.get(ip) || 0;
      successfulRegistrationsLocal.set(ip, count + 1);
    }
    req.flash('success', 'Registration successful! Please log in.');
    res.redirect('/auth/login');
  } catch (err: unknown) {
    console.error(
      'Registration error (inline limiter in auth.routes.ts):',
      err
    );
    res.status(500).json({
      error: 'Registration failed. Please try again.',
    });
  }
});

router.get('/login', (req: Request, res: Response) => {
  const errorMessages: string[] = req.flash('error');
  const successMessages: string[] = req.flash('success');
  res.status(200).json({
    message: 'GET /login - serves login form (not used by API tests)',
    error: errorMessages.length > 0 ? errorMessages[0] : null,
    success: successMessages.length > 0 ? successMessages[0] : null,
  });
});

router.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/auth/profile',
    failureRedirect: '/auth/login',
    failureFlash: true,
    successFlash: 'Welcome back!',
  })
);

router.get('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err?: Error | null) => {
    if (err) {
      return next(err);
    }
    req.flash('success', 'You have been logged out.');
    res.redirect('/auth/login');
  });
});

router.get('/profile', (req: Request, res: Response) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({
      message: 'User profile data.',
      user: req.user, // req.user should contain { id: string, isAdmin: boolean }
    });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

async function validateRegistration(
  username: string,
  email: string,
  password: string,
  userRepository: import('typeorm').Repository<User>
): Promise<string | null> {
  if (!userRepository) {
    return 'Validation setup error: User repository not provided.';
  }
  const blacklistedLogins: string[] = [
    'attempts',
    'login',
    'register',
    'ban',
    'mod',
    'notifications',
    'test',
    'profile',
    'api',
    'admin',
    'page',
    'about',
    'help',
    'account',
    'settings',
    'logout',
    'redirect',
    'oauth',
    'delete',
    'faq',
    'donate',
    'feed',
    'app',
    'auth',
    'compare',
    'gallery',
    'change-password',
    'users',
    'user',
    'bio',
  ];
  if (!username || !password || !email) {
    return 'Username, email, and password are required.';
  }
  if (blacklistedLogins.includes(username.toLowerCase())) {
    return 'This username is not allowed.';
  }
  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    return 'Username must be 3-30 characters and can only contain letters, numbers, hyphens (-), and underscores (_).';
  }
  if (!validator.isEmail(email)) {
    return 'Invalid email format.';
  }
  const existingUserByLogin = await userRepository.findOneBy({
    login: username,
  });
  if (existingUserByLogin) {
    return 'Username already exists.';
  }
  const existingUserByEmail = await userRepository.findOneBy({ email: email });
  if (existingUserByEmail) {
    return 'Email already registered.';
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return passwordError;
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  const passwordStrength = zxcvbn(password);
  if (passwordStrength.score < 3) {
    let suggestions = '';
    if (passwordStrength.feedback && passwordStrength.feedback.suggestions) {
      suggestions =
        ' Suggestions: ' + passwordStrength.feedback.suggestions.join(' ');
    }
    return `Password is too weak (score: ${passwordStrength.score}/4).${suggestions} Please choose a stronger password.`;
  }
  return null;
}

export async function seedAdminUser(): Promise<void> {
  const adminLogin = process.env.ADMIN_DEFAULT_LOGIN;
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL;
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
  if (!adminLogin || !adminEmail || !adminPassword) {
    console.warn(
      'Default admin env data not fully set. Skipping admin seeding.'
    );
    return;
  }

  const userRepository = AppDataSource.getRepository(User);
  try {
    const existingAdmin = await userRepository.findOne({
      where: [{ login: adminLogin }, { email: adminEmail }],
    });
    if (existingAdmin) {
      console.log('Default admin user already exists.');
      return;
    }
    const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    const adminUser = new User();
    adminUser.login = adminLogin;
    adminUser.email = adminEmail;
    adminUser.password = hashedPassword;
    adminUser.isAdmin = true;
    await userRepository.save(adminUser);
    console.log('Default admin user created successfully.');
  } catch (error) {
    console.error('Error seeding default admin user:', error);
  }
}

export default router;
