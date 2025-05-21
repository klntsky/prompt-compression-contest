import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  // NotFoundException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TestResultService } from './test-result.service';
import { TestResult } from './test-result.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';

@Controller('test-results')
export class TestResultController {
  constructor(private readonly testResultService: TestResultService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findByAttemptId(
    @Query('attemptId', ParseIntPipe) attemptId: number,
    @Request() req: { user: JwtPayload },
  ): Promise<TestResult[]> {
    // The service method TestResultService.findAllByAttemptId already handles
    // throwing a NotFoundException if the attemptId itself doesn't exist.
    return this.testResultService.findAllByAttemptId(attemptId, req.user);
  }

  // We could also add an endpoint to get a specific TestResult by its composite key (attemptId, testId)
  // e.g., GET /test-results/:attemptId/:testId
  // Or a general GET /test-results to list all with pagination, etc.
}
