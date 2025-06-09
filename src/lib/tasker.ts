import 'dotenv/config';
import AppDataSource from '../api/data-source.js';
import { Attempt } from '../api/entities/attempt.js';
import { Test } from '../api/entities/test.js';
import { TestResult, TestResultStatus } from '../api/entities/test-result.js';
import { evaluatePrompt, getCompressedTask, TestCase } from './evaluate.js';
import stringify from 'fast-json-stable-stringify';

const POLL_INTERVAL = process.env.TASKER_POLL_INTERVAL
  ? parseInt(process.env.TASKER_POLL_INTERVAL, 10)
  : 5000;

/**
 * Processes a single test case for a given attempt.
 * It creates a preliminary test result, runs the evaluation,
 * and then updates the result with the final outcome.
 * @param test The test to process.
 * @param attempt The attempt context.
 */
async function processTest(test: Test, attempt: Attempt): Promise<void> {
  const testResultRepo = AppDataSource.getRepository(TestResult);
  console.log(`Processing test ${test.id} for attempt ${attempt.id}`);

  // 1. Create a preliminary test result to "lock" it and prevent reprocessing.
  const testResult = testResultRepo.create({
    attemptId: attempt.id,
    testId: test.id,
  });
  await testResultRepo.save(testResult);

  try {
    // 2. Run uncompressed and compressed evaluations.
    const testCase: TestCase = JSON.parse(test.payload);
    const evaluationModel = test.model;
    const { compressingPrompt, model: compressionModel } = attempt;

    const uncompressedResult = await evaluatePrompt({
      testCase,
      model: evaluationModel,
    });

    const { compressedTask, requestJson: compressionRequestJson } =
      await getCompressedTask({
        task: testCase.task,
        compressingPrompt,
        model: compressionModel,
      });

    const compressedTestCase: TestCase = { ...testCase, task: compressedTask };
    const compressedResult = await evaluatePrompt({
      testCase: compressedTestCase,
      model: evaluationModel,
    });

    // 3. Calculate metrics and gather request data.
    const uncompressedTokens = uncompressedResult.usage.prompt_tokens;
    const compressedTokens = compressedResult.usage.prompt_tokens;
    const compressionRatio =
      uncompressedTokens > 0
        ? (uncompressedTokens - compressedTokens) / uncompressedTokens
        : 0;

    const requests = {
      compression: JSON.parse(compressionRequestJson),
      evaluationUncompressed: uncompressedResult.requestJson
        ? JSON.parse(uncompressedResult.requestJson)
        : null,
      evaluationCompressed: compressedResult.requestJson
        ? JSON.parse(compressedResult.requestJson)
        : null,
    };

    // 4. Update the test result with the final outcome.
    testResult.status = compressedResult.passed
      ? TestResultStatus.VALID
      : TestResultStatus.FAILED;
    testResult.compressedPrompt = compressedTask;
    testResult.compressionRatio = compressionRatio;
    testResult.requestJson = stringify(requests);

    await testResultRepo.save(testResult);
    console.log(
      `Successfully processed test ${test.id} for attempt ${attempt.id}`
    );
  } catch (error) {
    console.error(
      `Failed to process test ${test.id} for attempt ${attempt.id}:`,
      error
    );
    // 5. Explicitly mark the test as failed on error.
    testResult.status = TestResultStatus.FAILED;
    await testResultRepo.save(testResult);
  }
}

/**
 * Finds and processes all pending tests for a given attempt in parallel.
 * @param attempt The attempt to process.
 */
async function processAttempt(attempt: Attempt): Promise<void> {
  console.log(`Processing attempt ${attempt.id}`);
  const testRepo = AppDataSource.getRepository(Test);

  // 1. Find all active tests for this attempt that haven't been processed yet.
  const testsToProcess = await testRepo
    .createQueryBuilder('test')
    .where('test.isActive = true')
    .andWhere(qb => {
      const subQuery = qb
        .subQuery()
        .select('1')
        .from(TestResult, 'tr')
        .where('tr.attempt_id = :attemptId', { attemptId: attempt.id })
        .andWhere('tr.test_id = test.id')
        .getQuery();
      return `NOT EXISTS ${subQuery}`;
    })
    .getMany();

  if (testsToProcess.length === 0) {
    console.log(`Attempt ${attempt.id} has no more tests to process.`);
    return;
  }

  console.log(
    `Found ${testsToProcess.length} tests to process for attempt ${attempt.id}`
  );

  // 2. Process all tests for the attempt in parallel.
  await Promise.all(testsToProcess.map(test => processTest(test, attempt)));
}

/**
 * Runs the tasker process to evaluate compression attempts.
 */
async function run() {
  await AppDataSource.initialize();
  console.log('Tasker started, connected to DB.');

  // The main loop continuously polls for new attempts to process.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const attemptRepo = AppDataSource.getRepository(Attempt);

      // 1. Find the oldest attempt with pending tests.
      const attempt = await attemptRepo
        .createQueryBuilder('attempt')
        .where(qb => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from(Test, 'test')
            .where('test.isActive = true')
            .andWhere(
              `NOT EXISTS (
                SELECT 1 
                FROM test_result tr 
                WHERE tr.attempt_id = attempt.id 
                AND tr.test_id = test.id
              )`
            )
            .getQuery();
          return `EXISTS ${subQuery}`;
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
