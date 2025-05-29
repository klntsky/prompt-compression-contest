import AppDataSource from '../api/data-source.js';
import { Test } from '../api/entities/test.js';
import type { TestCase } from './evaluate.js';

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
 * Store processed test cases to the database.
 * Each test case is serialized and stored as a Test entity with associated metadata.
 * @param params Parameters for storing test cases
 * @param params.testCases Array of test cases to store
 * @param params.model Model name used for the test cases
 * @param params.datasetName Name of the dataset the test cases belong to
 * @param params.numAttempts Number of attempts made for these test cases
 * @returns Promise that resolves when all test cases are stored
 * @throws Error if database operation fails or connection is not initialized
 */
export async function storeProcessedTestCases(params: {
  testCases: TestCase[];
  model: string;
  datasetName: string;
  numAttempts: number;
}): Promise<void> {
  const { testCases, model, datasetName } = params;
  const testRepository = AppDataSource.getRepository(Test);

  for (const testCase of testCases) {
    // Create test entry with serialized test case data
    const test = testRepository.create({
      model,
      payload: JSON.stringify({
        datasetName,
        task: testCase.task,
        options: testCase.options,
        correctAnswer: testCase.correctAnswer,
      }),
    });

    await testRepository.save(test);
  }
}

/**
 * Check if test cases already exist for a specific dataset and model combination.
 * Uses pattern matching on the serialized payload to find matching entries.
 * @param params Parameters for checking existing tests
 * @param params.model Model name to search for
 * @param params.datasetName Dataset name to search for
 * @returns Promise that resolves to the count of existing test cases
 * @throws Error if database query fails or connection is not initialized
 */
export async function getExistingTestCount(params: {
  model: string;
  datasetName: string;
}): Promise<number> {
  const { model, datasetName } = params;
  const testRepository = AppDataSource.getRepository(Test);

  return await testRepository
    .createQueryBuilder('test')
    .where('test.model = :model', { model })
    .andWhere('test.payload LIKE :datasetPattern', {
      datasetPattern: `%"datasetName":"${datasetName}"%`,
    })
    .getCount();
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
