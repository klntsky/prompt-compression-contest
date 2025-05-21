import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EvaluationService } from './evaluation.service';
import { TestModule } from '../test/test.module';
import { TestResultModule } from '../test-result/test-result.module';

@Module({
  imports: [HttpModule, TestModule, TestResultModule],
  providers: [EvaluationService],
})
export class EvaluationModule {}
