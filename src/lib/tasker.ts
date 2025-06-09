import 'dotenv/config';
import AppDataSource from '../api/data-source.js';
import { Attempt } from '../api/entities/attempt.js';
import { Test } from '../api/entities/test.js';
import { TestResult, TestResultStatus } from '../api/entities/test-result.js';
import { evaluateCompression, TestCase } from './evaluate.js';

const POLL_INTERVAL = process.env.TASKER_POLL_INTERVAL
  ? parseInt(process.env.TASKER_POLL_INTERVAL, 10)
  : 5000;

/**
 * Processes all pending tests for a given attempt.
 *
 * This function performs the following steps:
 * 1. It finds all active tests that do not have a result for the given attempt.
 * 2. It processes each of these tests in parallel.
 *
 * For each test, it will:
 * a. Create a preliminary "pending" test result in the database to "lock" the
 *    test, preventing other tasker instances from processing the same one.
 * b. Run the compression and evaluation logic using `evaluateCompression`.
 * c. Update the test result with the final outcome (valid, failed), along with
 *    metrics.
 * d. If any step fails, it marks the test as failed to ensure no test is left
 *    in a pending state.
 *
 * @param attempt The attempt context, containing the compressing prompt and
 * model information.
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

  // Process all the pending tests in parallel.
  const processingPromises = testsToProcess.map(async test => {
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
    } catch (error) {
      // This likely failed due to a unique constraint violation, meaning another
      // tasker instance picked it up. We can safely skip processing.
      console.warn(
        `Failed to create test result for test ${test.id}, attempt ${attempt.id}. It might already be processing by another tasker instance.`,
        error
      );
      return;
    }

    // Run the full evaluation and update the test result with the final outcome.
    try {
      const testCase: TestCase = {
        id: test.id,
        ...JSON.parse(test.payload),
      };

      const compressionResult = await evaluateCompression({
        testCases: [testCase],
        compressingPrompt: attempt.compressingPrompt,
        compressionModel: attempt.model,
        evaluationModel: test.model,
      });

      const result = compressionResult.results[0];

      // Update test result with the final outcome.
      testResult.status = result.compressedResult.passed
        ? TestResultStatus.VALID
        : TestResultStatus.FAILED;
      testResult.compressedPrompt = result.compressedTask;
      testResult.compressionRatio = result.compressionRatio;
      testResult.requestJson = result.requestJson;

      await testResultRepo.save(testResult);

      console.log(
        `Successfully processed test ${test.id} for attempt ${attempt.id}`
      );
    } catch (error) {
      console.error(
        `Failed to process test ${test.id} for attempt ${attempt.id}:`,
        error
      );
      // On failure, explicitly mark the test as failed to prevent it from being
      // stuck in a pending state.
      testResult.status = TestResultStatus.FAILED;
      await testResultRepo.save(testResult);
    }
  });
  await Promise.all(processingPromises);
}

/**
 * Runs the tasker process to evaluate compression attempts.
 */
async function run() {
  await AppDataSource.initialize();
  console.log('Tasker started, connected to DB.');

  // The main loop continuously polls for new attempts to process.
  while (true) {
    try {
      const attemptRepo = AppDataSource.getRepository(Attempt);

      // 1. Find the oldest attempt with no test results.
      const attempt = await attemptRepo
        .createQueryBuilder('attempt')
        .where(qb => {
          const subQuery = qb
            .subQuery()
            .select('test.id')
            .from(Test, 'test')
            .leftJoin('test.testResults', 'tr', 'tr.attempt_id = attempt.id')
            .where('test.isActive = true')
            .andWhere('tr.attempt_id IS NULL')
            .getQuery();
          return `EXISTS (${subQuery})`;
        })
        .orderBy('attempt.timestamp', 'ASC')
        .getOne();

      if (attempt) {
        // 2. Process the entire attempt.
        await processAttempt(attempt);
      }
    } catch (error) {
      console.error('An error occurred in the tasker loop:', error);
    }
    // 3. Wait before checking for new attempts again.
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

run().catch(error => {
  console.error('Tasker failed to start:', error);
  process.exit(1);
});
