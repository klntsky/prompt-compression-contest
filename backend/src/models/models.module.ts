import { Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { EvaluationModule } from '../evaluation/evaluation.module';

@Module({
  imports: [EvaluationModule],
  controllers: [ModelsController],
})
export class ModelsModule {}
