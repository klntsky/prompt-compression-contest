import AppDataSource from '../api/data-source.js';
import { Test } from '../api/entities/test.js';
import type { TestCase } from './evaluate.js';

/**
 * Singleton service for managing database operations related to test cases and evaluations.
 * Provides methods for storing, retrieving, and managing test data in the database.
 * @class DatabaseService
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private initialized = false;
  /**
   * Private constructor to enforce singleton pattern.
   * Use getInstance() to get the singleton instance.
   * @private
   */
  private constructor() {}
  /**
   * Gets the singleton instance of DatabaseService.
   * Creates a new instance if one doesn't exist.
   * @static
   * @returns {DatabaseService} The singleton DatabaseService instance
   */
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }
  /**
   * Initialize database connection if not already initialized.
   * This method is idempotent - calling it multiple times is safe.
   * @async
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   * @throws {Error} If database connection fails to initialize
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      this.initialized = true;
    }
  }
  /**
   * Store processed test cases to the database.
   * Each test case is serialized and stored as a Test entity with associated metadata.
   * @async
   * @param {Object} params - Parameters for storing test cases
   * @param {TestCase[]} params.testCases - Array of test cases to store
   * @param {string} params.model - Model name used for the test cases
   * @param {string} params.datasetName - Name of the dataset the test cases belong to
   * @param {number} params.numAttempts - Number of attempts made for these test cases
   * @returns {Promise<void>} Promise that resolves when all test cases are stored
   * @throws {Error} If database operation fails or connection is not initialized
   */
  async storeProcessedTestCases(params: {
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
   * @async
   * @param {Object} params - Parameters for checking existing tests
   * @param {string} params.model - Model name to search for
   * @param {string} params.datasetName - Dataset name to search for
   * @returns {Promise<number>} Promise that resolves to the count of existing test cases
   * @throws {Error} If database query fails or connection is not initialized
   */
  async getExistingTestCount(params: {
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
   * This method is idempotent - calling it multiple times is safe.
   * @async
   * @returns {Promise<void>} Promise that resolves when connection is closed
   * @throws {Error} If database connection fails to close properly
   */
  async close(): Promise<void> {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      this.initialized = false;
    }
  }
}
