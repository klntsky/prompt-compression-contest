import { Router, Request as ExpressRequest, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import AppDataSource from '../data-source.js';
import { User } from '../entities/user.js';
import {
  registrationLimiter,
  successfulRegistrations,
  SALT_ROUNDS,
  JWT_SECRET,
} from '../middlewares.js';

const router = Router();

router.post(
  '/register',
  registrationLimiter,
  async (req: ExpressRequest, res: Response): Promise<void> => {
    const { email, login, password, repeatedPassword } = req.body;
    const ip = req.ip;

    if (!email || !login || !password || !repeatedPassword) {
      res
        .status(400)
        .send('Email, login, password, and repeated password are required.');
      return;
    }
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).send('Invalid email format.');
      return;
    }
    if (password !== repeatedPassword) {
      res.status(400).send('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      res.status(400).send('Password must be at least 8 characters long.');
      return;
    }

    const userRepository = AppDataSource.getRepository(User);
    try {
      const existingUserByEmail = await userRepository.findOne({
        where: { email },
      });
      if (existingUserByEmail) {
        res.status(409).send('User with this email already exists.');
        return;
      }
      const existingUserByLogin = await userRepository.findOne({
        where: { login },
      });
      if (existingUserByLogin) {
        res.status(409).send('User with this login identifier already exists.');
        return;
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const newUser = new User();
      newUser.email = email;
      newUser.login = login;
      newUser.password = hashedPassword;
      // newUser.isAdmin is false by default as per entity definition
      await userRepository.save(newUser);

      // Increment successful registration count for this IP
      if (ip && ip.length > 0) {
        successfulRegistrations.set(
          ip,
          (successfulRegistrations.get(ip) || 0) + 1
        );
        setTimeout(
          () => {
            const currentCount = successfulRegistrations.get(ip);
            if (currentCount && currentCount > 0) {
              successfulRegistrations.set(ip, currentCount - 1);
              if (successfulRegistrations.get(ip) === 0)
                successfulRegistrations.delete(ip);
            } else {
              successfulRegistrations.delete(ip);
            }
          },
          24 * 60 * 60 * 1000
        );
      }
      res.status(201).send({
        message: 'User registered successfully.',
        login: newUser.login,
        isAdmin: newUser.isAdmin,
      });
    } catch (error) {
      console.error('Error during registration:', error);
      res.status(500).send('An error occurred during registration.');
    }
  }
);

router.post(
  '/login',
  async (req: ExpressRequest, res: Response): Promise<void> => {
    const { loginOrEmail, password } = req.body;
    if (!loginOrEmail || !password) {
      res.status(400).send('Login identifier/email and password are required.');
      return;
    }
    const userRepository = AppDataSource.getRepository(User);
    try {
      let user: User | null = null;
      if (loginOrEmail.includes('@')) {
        user = await userRepository.findOne({ where: { email: loginOrEmail } });
      } else {
        user = await userRepository.findOne({ where: { login: loginOrEmail } });
      }
      if (!user) {
        res.status(401).send('Invalid credentials.');
        return;
      }
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        res.status(401).send('Invalid credentials.');
        return;
      }
      const tokenPayload = {
        userLogin: user.login,
        email: user.email,
        isAdmin: user.isAdmin,
      };
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
      res.status(200).send({ message: 'Login successful.', token: token });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).send('An error occurred during login.');
    }
  }
);

router.post('/logout', (req: ExpressRequest, res: Response) => {
  res
    .status(200)
    .send('Logout successful. Please clear your token on the client-side.');
});

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
