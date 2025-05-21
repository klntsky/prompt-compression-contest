import { Controller, Get } from '@nestjs/common';
import { EvaluationService } from '../evaluation/evaluation.service';
import { OpenRouterModel } from '../evaluation/evaluation.service'; // Import OpenRouterModel
// Assuming OpenRouterModel is defined in EvaluationService or a shared types file
// If it's not exported from EvaluationService's file, you might need to define/import it here.
// For now, let's assume it will resolve or use 'any' if not strictly typed here.

@Controller('models')
export class ModelsController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Get('available')
  async getAvailableModels(): Promise<OpenRouterModel[]> {
    // Use specific type
    return this.evaluationService.getAvailableModels();
  }
}
