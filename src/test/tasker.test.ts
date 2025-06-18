import { startTasker } from '../lib/tasker';
import AppDataSource from '../api/data-source';
import { evaluateCompression } from '../lib/evaluate';
import stringify from 'fast-json-stable-stringify';
import { Attempt } from '@/api/entities/attempt';
import { Test } from '@/api/entities/test';
import { User } from '@/api/entities/user';

const evaluateCompressionMock: typeof evaluateCompression = async params => {
  const { testCase } = params;
  console.log(`Mock evaluating test case ${testCase.id}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    testCase: testCase,
    compressedResult: {
      passed: true,
      usage: {
        prompt_tokens: 50,
        completion_tokens: 50,
        total_tokens: 100,
      },
      requestJson: stringify({ mock: 'evaluation request' }),
    },
    compressionUsage: {
      prompt_tokens: 20,
      completion_tokens: 10,
      total_tokens: 30,
    },
    compressionRatio: 1.5,
    compressedTask: 'This is a mock compressed task.',
    requestJson: stringify({ mock: 'compression request' }),
  };
};

async function createTestUser() {
  const userRepo = AppDataSource.getRepository(User);
  const user = new User();
  user.login = 'test';
  user.email = 'test@test.com';
  user.password = 'password';
  await userRepo.save(user);
}

async function createAttempts(n: number) {
  for (let i = 0; i < n; i++) {
    const attempt = new Attempt();
    attempt.compressingPrompt = 'This is a mock compressing prompt.';
    attempt.model = 'This is a mock compression model.';
    attempt.login = 'test';
    const attemptRepo = AppDataSource.getRepository(Attempt);
    await attemptRepo.save(attempt);
  }
}

async function createTests(n: number) {
  for (let i = 0; i < n; i++) {
    const test = new Test();
    const testPayload = {
      task: `This is mock task ${i}`,
      options: ['A', 'B', 'C'],
      correctAnswer: 'A',
    };
    test.payload = JSON.stringify(testPayload);
    test.model = 'This is a mock test model.';
    test.isActive = true;
    test.totalTokens = 100;
    const testRepo = AppDataSource.getRepository(Test);
    await testRepo.save(test);
  }
}

async function main() {
  await AppDataSource.initialize();
  await createTestUser();
  await createTests(2);
  await createAttempts(2);
  await startTasker(evaluateCompressionMock, true); // Simulate failure once
}

main().catch(error => {
  console.error('Tasker failed to start:', error);
  process.exit(1);
});
