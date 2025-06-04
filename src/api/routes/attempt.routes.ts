import { Router, Response } from 'express';
import AppDataSource from '../data-source.js';
import { Attempt } from '../entities/attempt.js';
import { User } from '../entities/user.js';
import {
  AuthenticatedRequest,
  authenticateToken,
  attemptsLimiterPerHour,
  attemptsLimiterPerDay,
} from '../middlewares.js';

const router = Router();

router.post(
  '/',
  authenticateToken,
  attemptsLimiterPerHour,
  attemptsLimiterPerDay,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { compressing_prompt, model } = req.body;
    const userLogin = req.auth?.userLogin;

    if (!userLogin) {
      res.status(401).send('Unauthorized: User login not found in token.');
      return;
    }
    if (!compressing_prompt || !model) {
      res
        .status(400)
        .send('Missing required fields: compressing_prompt and model.');
      return;
    }

    const attemptRepository = AppDataSource.getRepository(Attempt);
    const userRepository = AppDataSource.getRepository(User);

    try {
      const user = await userRepository.findOne({
        where: { login: userLogin },
      });
      if (!user) {
        res.status(404).send('User not found.');
        return;
      }

      const newAttempt = new Attempt();
      newAttempt.compressing_prompt = compressing_prompt;
      newAttempt.model = model;
      newAttempt.login = userLogin; // Set the login foreign key directly
      newAttempt.user = user; // Associate the user object

      await attemptRepository.save(newAttempt);
      res.status(201).send({
        message: 'Attempt submitted successfully.',
        attemptId: newAttempt.id,
      });
    } catch (error) {
      console.error('Error submitting attempt:', error);
      res.status(500).send('An error occurred while submitting the attempt.');
    }
  }
);

export default router;
