import { Router, Response, Request } from 'express';
import AppDataSource from '../data-source.js';
import { Test } from '../entities/test.js';
import { authenticateToken, isAdminMiddleware } from '../middlewares.js';

const router = Router();

router.post(
  '/',
  authenticateToken,
  isAdminMiddleware,
  async (req: Request, res: Response): Promise<void> => {
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
      res.status(500).send('An error occurred while submitting the test.');
    }
  }
);

export default router;
