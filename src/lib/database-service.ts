import { Attempt } from '@/api/entities/attempt.js';
import AppDataSource from '../api/data-source.js';
import { Test } from '../api/entities/test.js';
import type { TestCaseResult } from './evaluate.js';
import stringify from 'fast-json-stable-stringify';
import { TestResultStatus } from '@/api/entities/test-result.js';

// Module-level state
let isInitialized = false;

/**
 * Initialize database connection if not already initialized.
 * This function is idempotent - calling it multiple times is safe.
 * @returns Promise that resolves when initialization is complete
 * @throws Error if database connection fails to initialize
 */
export async function initializeDatabase(): Promise<void> {
  if (!isInitialized) {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    isInitialized = true;
  }
}

/**
 * Store processed test cases to the database, avoiding duplicates.
 * Uses TypeORM upsert for efficient bulk insertion with conflict resolution.
 * @param testCaseResults Array of test cases to store
 * @param model Model name used for the test cases
 * @param datasetName Name of the dataset the test cases belong to
 * @returns Promise that resolves to the number of new test cases stored
 * @throws Error if database operation fails or connection is not initialized
 */
export async function storeProcessedTestCases(
  testCaseResults: TestCaseResult[],
  model: string,
  datasetName: string
): Promise<number> {
  if (testCaseResults.length === 0) {
    return 0;
  }
  const testRepository = AppDataSource.getRepository(Test);
  // Prepare all test entities
  const testEntities: Test[] = testCaseResults.map(testCaseResult => ({
    model,
    payload: stringify({
      datasetName,
      task: testCaseResult.testCase.task,
      options: testCaseResult.testCase.options,
      correctAnswer: testCaseResult.testCase.correctAnswer,
    }),
    isActive: true,
    totalTokens: testCaseResult.result.usage.total_tokens,
  })) as Test[];
  // Use upsert to handle duplicates efficiently
  // This relies on the unique constraint on (model, payload)
  const result = await testRepository.upsert(testEntities, {
    conflictPaths: ['model', 'payload'], // Specify the columns for conflict detection
    skipUpdateIfNoValuesChanged: true, // Recommended for ON CONFLICT DO NOTHING behavior
  });
  return result.identifiers.length;
}

// Find the oldest pending attempt that still has tests to run.
export async function getUntestedAttempt(): Promise<Attempt | null> {
  const attemptRepo = AppDataSource.getRepository(Attempt);
  return await attemptRepo
    .createQueryBuilder('attempt')
    .where('attempt.averageCompressionRatio IS NULL')
    .andWhere(
      'NOT EXISTS (SELECT 1 FROM test_result tr WHERE tr.attempt_id = attempt.id AND tr.status = :status)',
      { status: TestResultStatus.FAILED }
    )
    .orderBy('attempt.timestamp', 'ASC')
    .getOne();
}

// Find all active tests for the current attempt that don't have a result yet.
export async function getTestsToProcess(attempt: Attempt): Promise<Test[]> {
  const testRepo = AppDataSource.getRepository(Test);
  const testsToProcess = await testRepo
    .createQueryBuilder('test')
    .leftJoin('test.testResults', 'tr', 'tr.attempt_id = :attemptId', {
      attemptId: attempt.id,
    })
    .where('test.isActive = true')
    .andWhere('(tr.attempt_id IS NULL OR tr.status = :status)', {
      status: TestResultStatus.PENDING,
    })
    .getMany();
  if (testsToProcess.length === 0) {
    console.log(`Attempt ${attempt.id} has no more tests to process.`);
    return [];
  }
  console.log(
    `Found ${testsToProcess.length} tests to process for attempt ${attempt.id}`
  );
  return testsToProcess;
}

// Aggregate the results of the attempt.
export async function aggregateResults(
  testsPassed: number,
  totalCompressionRatio: number,
  attempt: Attempt
): Promise<void> {
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
 * Close the database connection and reset initialization state.
 * This function is idempotent - calling it multiple times is safe.
 * @returns Promise that resolves when connection is closed
 * @throws Error if database connection fails to close properly
 */
export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    isInitialized = false;
  }
}
