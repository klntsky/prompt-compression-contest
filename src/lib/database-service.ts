import AppDataSource from '../api/data-source.js';
import { Test } from '../api/entities/test.js';
import type { TestCaseResult } from './evaluate.js';
import stringify from 'fast-json-stable-stringify';

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
