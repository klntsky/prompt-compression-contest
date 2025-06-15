import 'dotenv/config';
import AppDataSource from '../api/data-source.js';
import { Attempt } from '../api/entities/attempt.js';
import { Test } from '../api/entities/test.js';
import { TestResult, TestResultStatus } from '../api/entities/test-result.js';
import { evaluateCompression } from './evaluate.js';

const POLL_INTERVAL = process.env.TASKER_POLL_INTERVAL
  ? parseInt(process.env.TASKER_POLL_INTERVAL, 10)
  : 5000;

/**
 * Finds all active tests that do not have a result for the given attempt and
 * processes each of these tests in parallel
 *
 * For each test, it will:
 * a. Create a "pending" test result to lock the test.
 * b. Run the compression and evaluation logic.
 * c. Update the test result with the final outcome and metrics.
 * d. Mark the test as failed if any step fails.
 *
 * @param attempt The attempt context, containing the compressing prompt and model information.
 */
async function processAttempt(attempt: Attempt): Promise<void> {
  console.log(`Processing attempt ${attempt.id}`);
  const testRepo = AppDataSource.getRepository(Test);
  const testResultRepo = AppDataSource.getRepository(TestResult);
  // Find all active tests for the current attempt that don't have a result yet.
  const testsToProcess = await testRepo
    .createQueryBuilder('test')
    .leftJoin('test.testResults', 'tr', 'tr.attempt_id = :attemptId', {
      attemptId: attempt.id,
    })
    .where('test.isActive = true')
    .andWhere('tr.attempt_id IS NULL')
    .getMany();
  if (testsToProcess.length === 0) {
    console.log(`Attempt ${attempt.id} has no more tests to process.`);
    return;
  }
  console.log(
    `Found ${testsToProcess.length} tests to process for attempt ${attempt.id}`
  );
  // Process each test in a loop.
  let testsPassed = 0;
  let totalCompressionRatio = 0;
  for (const test of testsToProcess) {
    console.log(`Processing test ${test.id} for attempt ${attempt.id}`);
    // Create a preliminary test result to "lock" the test and prevent other
    // instances from processing it.
    const testResult = testResultRepo.create({
      attemptId: attempt.id,
      testId: test.id,
      status: TestResultStatus.PENDING,
    });
    try {
      await testResultRepo.save(testResult);
    } catch {
      console.warn(
        `Failed to create test result for test ${test.id}, attempt ${attempt.id}. It may already be processing.`
      );
      continue;
    }
    try {
      const result = await evaluateCompression({
        testCase: { id: test.id, ...JSON.parse(test.payload) },
        uncompressedTotalTokens: test.totalTokens || 0,
        compressingPrompt: attempt.compressingPrompt,
        compressionModel: attempt.model,
        evaluationModel: test.model,
      });
      // Update test result with the final outcome.
      testResult.status = result.compressedResult.passed
        ? TestResultStatus.VALID
        : TestResultStatus.FAILED;
      testResult.compressedPrompt = result.compressedTask;
      testResult.compressionRatio = result.compressionRatio;
      testResult.requestJson = result.requestJson;
      await testResultRepo.save(testResult);
      if (testResult.status === TestResultStatus.VALID) {
        testsPassed++;
        totalCompressionRatio += result.compressionRatio;
        console.log(
          `Successfully processed test ${test.id} for attempt ${attempt.id}`
        );
      } else {
        throw new Error('Test evaluation failed');
      }
    } catch (error) {
      console.error(
        `Failed to process test ${test.id} for attempt ${attempt.id}:`,
        error
      );
      testResult.status = TestResultStatus.FAILED;
      await testResultRepo.save(testResult);
      return;
    }
  }
  // Aggregate the results of the attempt.
  try {
    const attemptRepo = AppDataSource.getRepository(Attempt);
    const averageCompressionRatio =
      testsPassed > 0 ? totalCompressionRatio / testsPassed : 0;
    attempt.averageCompressionRatio = averageCompressionRatio;
    await attemptRepo.save(attempt);
    console.log(
      `Attempt ${attempt.id} has been fully processed and aggregated.`
    );
  } catch (error) {
    console.error(`Failed to aggregate attempt ${attempt.id}:`, error);
  }
}

/**
 * Runs the main tasker process loop.
 *
 * This function performs the following steps in a continuous loop:
 * 1. Finds the oldest pending attempt that still has tests to run.
 * 2. Processes all remaining tests for the identified attempt.
 * 3. Aggregates the results once the attempt is fully processed.
 * 4. If no attempts left waits for a defined interval before starting the next cycle.
 */
export async function startTasker() {
  await AppDataSource.initialize();
  console.log('Tasker started, connected to DB.');
  while (true) {
    try {
      const attemptRepo = AppDataSource.getRepository(Attempt);
      const testRepo = AppDataSource.getRepository(Test);
      const activeTestsCount = await testRepo.count({
        where: { isActive: true },
      });
      const attempt = await attemptRepo
        .createQueryBuilder('attempt')
        .leftJoin('attempt.testResults', 'testResult')
        .leftJoin('testResult.test', 'test', 'test.isActive = true')
        .leftJoin(
          'attempt.testResults',
          'failedTestResult',
          'failedTestResult.status = :status',
          { status: TestResultStatus.FAILED }
        )
        .where('attempt.averageCompressionRatio IS NULL')
        .andWhere('failedTestResult.id IS NULL')
        .groupBy('attempt.id')
        .having('COUNT(DISTINCT test.id) < :activeTestsCount', {
          activeTestsCount,
        })
        .orderBy('attempt.timestamp', 'ASC')
        .getOne();
      if (attempt) {
        await processAttempt(attempt);
      } else {
        console.log('No pending attempts found, waiting for next poll.');
        await AppDataSource.destroy();
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }
    } catch (error) {
      console.error('An error occurred in the tasker loop:', error);
    }
  }
}
