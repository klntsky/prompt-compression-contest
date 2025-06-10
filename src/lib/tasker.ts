import 'dotenv/config';
import AppDataSource from '../api/data-source.js';
import { Attempt, AttemptStatus } from '../api/entities/attempt.js';
import { Test } from '../api/entities/test.js';
import { TestResult, TestResultStatus } from '../api/entities/test-result.js';
import {
  evaluateCompression,
  evaluatePrompt,
  TestCase,
  EvaluationResult,
} from './evaluate.js';
import { IsNull } from 'typeorm';

const POLL_INTERVAL = process.env.TASKER_POLL_INTERVAL
  ? parseInt(process.env.TASKER_POLL_INTERVAL, 10)
  : 5000;

/**
 * Evaluates an uncompressed test case and caches the result in the database.
 * A lock is implemented by setting the test's uncompressedStatus to 'pending',
 * which prevents other tasker instances from processing the same test.
 *
 * @param test The test to evaluate.
 */
async function evaluateUncompressedTest(test: Test): Promise<void> {
  // If the uncompressed test has already been run, we can skip it.
  if (test.uncompressedStatus !== null) {
    return;
  }
  const testRepo = AppDataSource.getRepository(Test);
  try {
    // Lock the test by setting its status to PENDING.
    test.uncompressedStatus = TestResultStatus.PENDING;
    await testRepo.save(test);
  } catch {
    // We can safely assume another tasker instance is handling it.
    console.warn(
      `Failed to lock uncompressed test ${test.id}. It may already be processing.`
    );
    return;
  }
  console.log(`Evaluating uncompressed test ${test.id}`);
  const testCase: TestCase = {
    id: test.id,
    ...JSON.parse(test.payload),
  };
  const uncompressedResult = await evaluatePrompt({
    testCase,
    model: test.model,
  });
  test.uncompressedStatus = uncompressedResult.passed
    ? TestResultStatus.VALID
    : TestResultStatus.FAILED;
  test.uncompressedRequestJson = uncompressedResult.requestJson;
  test.uncompressedPromptTokens = uncompressedResult.usage.prompt_tokens;
  await testRepo.save(test);
  console.log(
    `Uncompressed test ${test.id} evaluated. Status: ${test.uncompressedStatus}`
  );
}

/**
 * Processes all pending tests for a given attempt.
 *
 * This function performs the following steps:
 * 1. Finds all active tests that do not have a result for the given attempt.
 * 2. Ensures that all uncompressed tests have been evaluated before proceeding.
 * 3. Processes each of these tests in parallel.
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
  await Promise.all(
    testsToProcess.map(async test => {
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
        return;
      }
      try {
        const freshTest = await testRepo.findOneBy({ id: test.id });
        if (
          !freshTest ||
          freshTest.uncompressedStatus === TestResultStatus.PENDING ||
          !freshTest.uncompressedStatus
        ) {
          throw new Error(
            `Uncompressed test ${test.id} has not been evaluated yet.`
          );
        }
        if (freshTest.uncompressedStatus !== TestResultStatus.VALID) {
          console.log(
            `Skipping compression for test ${test.id} as it failed the uncompressed evaluation.`
          );
          testResult.status = TestResultStatus.FAILED;
          await testResultRepo.save(testResult);
          return;
        }
        const uncompressedResult: EvaluationResult = {
          passed: true,
          usage: {
            prompt_tokens: freshTest.uncompressedPromptTokens || 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
          requestJson: freshTest.uncompressedRequestJson,
        };
        const result = await evaluateCompression({
          testCase: { id: test.id, ...JSON.parse(test.payload) },
          uncompressedResult,
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
        console.log(
          `Successfully processed test ${test.id} for attempt ${attempt.id}`
        );
      } catch (error) {
        console.error(
          `Failed to process test ${test.id} for attempt ${attempt.id}:`,
          error
        );
        testResult.status = TestResultStatus.FAILED;
        await testResultRepo.save(testResult);
      }
    })
  );
}

/**
 * Aggregates the results of a completed attempt and updates the database.
 * @param attempt The attempt to aggregate results for.
 */
async function aggregateAttemptResults(attempt: Attempt): Promise<void> {
  const testResultRepo = AppDataSource.getRepository(TestResult);
  const testRepo = AppDataSource.getRepository(Test);
  const attemptRepo = AppDataSource.getRepository(Attempt);
  const testResults = await testResultRepo.find({
    where: { attemptId: attempt.id },
  });
  const totalTests = await testRepo.count({
    where: { isActive: true, uncompressedStatus: TestResultStatus.VALID },
  });
  if (testResults.length < totalTests) {
    return;
  }
  let testsPassed = 0;
  let totalCompressionRatio = 0;
  for (const result of testResults) {
    if (result.status === TestResultStatus.VALID) {
      testsPassed++;
      totalCompressionRatio += result.compressionRatio || 0;
    }
  }
  const averageCompressionRatio =
    testsPassed > 0 ? totalCompressionRatio / testsPassed : 0;
  attempt.status =
    totalTests > 0 && testsPassed === totalTests
      ? AttemptStatus.COMPLETED
      : AttemptStatus.FAILED;
  attempt.averageCompressionRatio = averageCompressionRatio;
  await attemptRepo.save(attempt);
  console.log(`Attempt ${attempt.id} has been fully processed and aggregated.`);
}

/**
 * Runs the main tasker process loop.
 *
 * This function performs the following steps in a continuous loop:
 * 1. Evaluates any uncompressed tests that have not yet been processed.
 * 2. Finds the oldest pending attempt that still has tests to run.
 * 3. Processes all remaining tests for the identified attempt.
 * 4. Aggregates the results once the attempt is fully processed.
 * 5. Waits for a defined interval before starting the next cycle.
 */
async function run() {
  await AppDataSource.initialize();
  console.log('Tasker started, connected to DB.');
  while (true) {
    try {
      const attemptRepo = AppDataSource.getRepository(Attempt);
      const testRepo = AppDataSource.getRepository(Test);
      const testsToEvaluate = await testRepo.find({
        where: { uncompressedStatus: IsNull(), isActive: true },
      });
      if (testsToEvaluate.length > 0) {
        console.log(
          `Found ${testsToEvaluate.length} uncompressed tests to evaluate.`
        );
        await Promise.all(testsToEvaluate.map(evaluateUncompressedTest));
      }
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
        .andWhere('attempt.status = :status', { status: AttemptStatus.PENDING })
        .orderBy('attempt.timestamp', 'ASC')
        .getOne();
      if (attempt) {
        await processAttempt(attempt);
        await aggregateAttemptResults(attempt);
      }
    } catch (error) {
      console.error('An error occurred in the tasker loop:', error);
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

run().catch(error => {
  console.error('Tasker failed to start:', error);
  process.exit(1);
});
