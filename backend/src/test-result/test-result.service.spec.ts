import { Test, TestingModule } from '@nestjs/testing';
import { TestResultService } from './test-result.service';

describe('TestResultService', () => {
  let service: TestResultService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestResultService],
    }).compile();

    service = module.get<TestResultService>(TestResultService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
