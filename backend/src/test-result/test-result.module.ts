import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestResult } from './test-result.entity';
import { TestResultService } from './test-result.service';
import { AttemptModule } from '../attempt/attempt.module';
import { TestModule } from '../test/test.module';
import { TestResultController } from './test-result.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TestResult]), AttemptModule, TestModule],
  providers: [TestResultService],
  exports: [TestResultService],
  controllers: [TestResultController],
})
export class TestResultModule {}
