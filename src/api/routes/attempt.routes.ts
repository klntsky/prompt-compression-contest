import { Router, Response, Request } from 'express';
import AppDataSource from '../data-source.js';
import { Attempt } from '../entities/attempt.js';
import { User } from '../entities/user.js';
import {
  AuthenticatedRequest,
  ensureAuthenticated,
  attemptsLimiterPerHour,
  attemptsLimiterPerDay,
} from '../middlewares.js';

// Define interface for request payload
interface AttemptPayload {
  compressing_prompt: string;
  model: string;
}

const router = Router();

router.post(
  '/create',
  ensureAuthenticated,
  attemptsLimiterPerHour,
  attemptsLimiterPerDay,
  async (req: Request, res: Response): Promise<void> => {
    const authenticatedReq = req as AuthenticatedRequest;
    const { compressing_prompt, model } =
      authenticatedReq.body as AttemptPayload;
    const userLogin = authenticatedReq.user.id;
    if (!userLogin) {
      res.status(401).send('Unauthorized: User ID not found in session.');
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
        res.status(404).send('User not found for the provided session ID.');
        return;
      }
      const newAttempt = new Attempt();
      newAttempt.compressing_prompt = compressing_prompt;
      newAttempt.model = model;
      newAttempt.login = userLogin;
      newAttempt.user = user;
      await attemptRepository.save(newAttempt);
      res.status(201).send({
        message: 'Attempt submitted successfully.',
        attemptId: newAttempt.id,
      });
    } catch (error: unknown) {
      console.error('Error submitting attempt:', error);
      res.status(500).send('An error occurred while submitting the attempt.');
    }
  }
);

export default router;
