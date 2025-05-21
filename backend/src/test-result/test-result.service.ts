import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestResult } from './test-result.entity';
import { CreateTestResultDto } from './dto/create-test-result.dto';
import { AttemptService } from '../attempt/attempt.service';
import { TestService } from '../test/test.service';
import { JwtPayload } from '../auth/jwt.strategy';

@Injectable()
export class TestResultService {
  constructor(
    @InjectRepository(TestResult)
    private testResultRepository: Repository<TestResult>,
    private attemptService: AttemptService,
    private testService: TestService,
  ) {}

  async create(
    createTestResultDto: CreateTestResultDto,
    currentUser?: JwtPayload,
  ): Promise<TestResult> {
    const { attemptId, testId } = createTestResultDto;

    await this.attemptService.findOne(attemptId, currentUser);
    await this.testService.findById(testId);

    const newTestResult = this.testResultRepository.create(createTestResultDto);
    return this.testResultRepository.save(newTestResult);
  }

  async findAllByAttemptId(
    attemptId: number,
    currentUser: JwtPayload,
  ): Promise<TestResult[]> {
    await this.attemptService.findOne(attemptId, currentUser);

    return this.testResultRepository.find({
      where: { attemptId },
      relations: ['test'],
    });
  }
}
