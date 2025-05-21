import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attempt } from './attempt.entity';
import { AttemptService } from './attempt.service';
import { AttemptController } from './attempt.controller';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { UserAccountModule } from '../user-account/user-account.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attempt]),
    EvaluationModule,
    UserAccountModule,
  ],
  providers: [AttemptService],
  controllers: [AttemptController],
  exports: [AttemptService],
})
export class AttemptModule {}
