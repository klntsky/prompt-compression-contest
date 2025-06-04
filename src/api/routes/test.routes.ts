import { Router, Response } from 'express';
import AppDataSource from '../data-source.js';
import { Test } from '../entities/test.js';
import {
  AuthenticatedRequest,
  authenticateToken,
  isAdminMiddleware,
} from '../middlewares.js';

const router = Router();

router.post(
  '/',
  authenticateToken,
  isAdminMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { model, payload } = req.body;

    if (!model || !payload) {
      res.status(400).send('Missing required fields: model and payload.');
      return;
    }

    const testRepository = AppDataSource.getRepository(Test);
    try {
      const newTest = new Test();
      newTest.model = model;
      newTest.payload = payload;

      await testRepository.save(newTest);
      res
        .status(201)
        .send({ message: 'Test submitted successfully.', testId: newTest.id });
    } catch (error: unknown) {
      console.error('Error submitting test:', error);
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const dbError = error as { code: string | number; message?: string };
        if (
          dbError.code === '23505' ||
          (dbError.message && dbError.message.includes('UQ_'))
        ) {
          res
            .status(409)
            .send(
              'Conflict: A test with this model and payload already exists.'
            );
          return;
        }
      } else if (error instanceof Error) {
        if (error.message.includes('UQ_')) {
          res
            .status(409)
            .send(
              'Conflict: A test with this model and payload already exists.'
            );
          return;
        }
      }
      res.status(500).send('An error occurred while submitting the test.');
    }
  }
);

export default router;
