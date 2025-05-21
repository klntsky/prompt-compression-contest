import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import { AttemptCreatedEvent } from '../attempt/events/attempt-created.event';
import { ATTEMPT_CREATED_EVENT } from '../attempt/attempt.service';
import { TestService } from '../test/test.service';
import { TestResultService } from '../test-result/test-result.service';
import { Test } from '../test/test.entity';

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  // Add other properties from OpenRouter's /models response as needed
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

interface OpenRouterErrorData {
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
  // other potential error fields
}

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);
  private readonly openRouterApiBaseUrl: string;
  private readonly openRouterApiKey: string;
  private readonly openRouterHttpReferer: string;
  private readonly openRouterXTitle: string;
  private readonly evaluationNumAttempts: number;
  private readonly modelsCacheTtlMs: number;

  private availableModelsCache: OpenRouterModel[] | null = null;
  private lastModelsFetchTime: number = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly testService: TestService,
    private readonly testResultService: TestResultService,
  ) {
    this.openRouterApiBaseUrl = this.configService.get<string>(
      'OPENROUTER_API_BASE_URL',
      'https://openrouter.ai/api/v1',
    );
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      this.logger.error(
        'CRITICAL: OpenRouter API key is not configured. Evaluation service will not work.',
      );
      this.openRouterApiKey = '';
    } else {
      this.openRouterApiKey = apiKey;
    }
    this.openRouterHttpReferer = this.configService.get<string>(
      'OPENROUTER_HTTP_REFERER',
      '',
    );
    this.openRouterXTitle = this.configService.get<string>(
      'OPENROUTER_X_TITLE',
      '',
    );
    this.evaluationNumAttempts = this.configService.get<number>(
      'EVALUATION_NUM_ATTEMPTS',
      3,
    );
    if (this.evaluationNumAttempts <= 0) {
      this.logger.warn(
        'EVALUATION_NUM_ATTEMPTS must be positive, defaulting to 1.',
      );
      this.evaluationNumAttempts = 1;
    }
    this.modelsCacheTtlMs = this.configService.get<number>(
      'OPENROUTER_MODELS_CACHE_TTL_MS',
      3600000,
    ); // Default 1 hour
  }

  public async getAvailableModels(): Promise<OpenRouterModel[]> {
    if (
      this.availableModelsCache &&
      Date.now() - this.lastModelsFetchTime < this.modelsCacheTtlMs
    ) {
      this.logger.debug('Returning cached OpenRouter models.');
      return this.availableModelsCache;
    }

    const modelsUrl = `${this.openRouterApiBaseUrl}/models`;
    try {
      this.logger.log('Fetching available models from OpenRouter...'); // Changed to log for first fetch
      const response = await firstValueFrom(
        this.httpService.get<OpenRouterModelsResponse>(modelsUrl),
      );
      this.availableModelsCache = response.data?.data || [];
      this.lastModelsFetchTime = Date.now();
      this.logger.log(
        `Fetched and cached ${this.availableModelsCache.length} models from OpenRouter.`,
      );
      return this.availableModelsCache;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Error fetching models from OpenRouter: ${axiosError.message}. Returning potentially stale cache or empty list.`,
      );
      // If fetching fails, return stale cache if available, otherwise empty. Avoids breaking if API is temporarily down.
      return this.availableModelsCache || [];
    }
  }

  private async callOpenRouter(
    compressingPrompt: string,
    testPayload: string,
    modelName: string,
  ): Promise<{ compressedText: string | null; error?: string }> {
    if (!this.openRouterApiKey) {
      this.logger.error('OpenRouter API key is not set. Cannot make API call.');
      return {
        compressedText: null,
        error: 'OpenRouter API key not configured internally',
      };
    }

    const apiUrl = `${this.openRouterApiBaseUrl}/chat/completions`;

    const headers: { [key: string]: string } = {
      Authorization: `Bearer ${this.openRouterApiKey}`,
      'Content-Type': 'application/json',
    };
    if (this.openRouterHttpReferer) {
      headers['HTTP-Referer'] = this.openRouterHttpReferer;
    }
    if (this.openRouterXTitle) {
      headers['X-Title'] = this.openRouterXTitle;
    }

    const body = {
      model: modelName,
      messages: [
        { role: 'system', content: compressingPrompt },
        { role: 'user', content: testPayload },
      ],
    };

    try {
      this.logger.debug(
        `Calling OpenRouter API: ${apiUrl} with model ${modelName}`,
      );
      const response = await firstValueFrom(
        this.httpService.post<OpenRouterResponse>(apiUrl, body, { headers }),
      );

      const compressedText =
        response.data?.choices?.[0]?.message?.content?.trim();
      if (compressedText) {
        this.logger.debug(
          `Received compressed text from OpenRouter for model ${modelName}`,
        );
        return { compressedText };
      } else if (response.data?.error) {
        this.logger.warn(
          `OpenRouter API returned an error: ${response.data.error.message}`,
          response.data,
        );
        return { compressedText: null, error: response.data.error.message };
      } else {
        this.logger.warn(
          'No content in OpenRouter response or unexpected structure.',
          response.data,
        );
        return {
          compressedText: null,
          error: 'No content or unexpected structure in OpenRouter response',
        };
      }
    } catch (error) {
      const axiosError = error as AxiosError<OpenRouterErrorData>;
      this.logger.error(
        `Error calling OpenRouter API for model ${modelName}: ${axiosError.message}`,
        axiosError.stack,
      );
      if (axiosError.response) {
        this.logger.error(
          `OpenRouter Error Response Data: ${JSON.stringify(axiosError.response.data)}`,
        );
        const errorMessage =
          axiosError.response.data?.error?.message || axiosError.message;
        return { compressedText: null, error: errorMessage };
      }
      return { compressedText: null, error: axiosError.message };
    }
  }

  @OnEvent(ATTEMPT_CREATED_EVENT)
  async handleAttemptCreatedEvent(payload: AttemptCreatedEvent) {
    this.logger.log(
      `Handling AttemptCreatedEvent for attempt ID: ${payload.attemptId}, model: ${payload.model}`,
    );
    if (!this.openRouterApiKey) {
      this.logger.error(
        'OpenRouter API key not configured. Skipping evaluation.',
      );
      return;
    }

    try {
      const compatibleTests: Test[] =
        await this.testService.findCompatibleTests(payload.model);
      this.logger.log(
        `Found ${compatibleTests.length} compatible tests for model '${payload.model}'.`,
      );

      if (compatibleTests.length === 0) {
        this.logger.warn(
          `No compatible tests found for attempt ID: ${payload.attemptId} and model: ${payload.model}.`,
        );
        return;
      }

      for (const test of compatibleTests) {
        this.logger.log(
          `Processing test ID: ${test.id} for attempt ID: ${payload.attemptId} with ${this.evaluationNumAttempts} attempts.`,
        );

        let successfulCalls = 0;
        let firstSuccessfulCompressedText: string | undefined = undefined;
        const successfulRatios: number[] = [];
        let lastError: string | undefined = undefined;

        for (let i = 0; i < this.evaluationNumAttempts; i++) {
          this.logger.debug(
            `Attempt ${i + 1}/${this.evaluationNumAttempts} for test ID: ${test.id}, attempt ID: ${payload.attemptId}`,
          );
          const aiResult = await this.callOpenRouter(
            payload.compressing_prompt,
            test.payload || '',
            payload.model,
          );

          if (aiResult.compressedText) {
            successfulCalls++;
            if (!firstSuccessfulCompressedText) {
              firstSuccessfulCompressedText = aiResult.compressedText;
            }
            if (
              test.payload &&
              test.payload.length > 0 &&
              aiResult.compressedText.length > 0
            ) {
              successfulRatios.push(
                aiResult.compressedText.length / test.payload.length,
              );
            }
          } else {
            lastError = aiResult.error;
            this.logger.warn(
              `AI call attempt ${i + 1} failed for test ID: ${test.id}. Error: ${aiResult.error}`,
            );
          }
          // Optional: Add a small delay between attempts if desired, e.g., await new Promise(r => setTimeout(r, 200));
        }

        const is_valid_output = successfulCalls === this.evaluationNumAttempts; // All attempts must succeed
        const compressed_prompt_output = firstSuccessfulCompressedText;
        const compression_ratio_output =
          successfulRatios.length > 0
            ? successfulRatios.reduce((acc, val) => acc + val, 0) /
              successfulRatios.length
            : undefined;

        if (!is_valid_output) {
          this.logger.warn(
            `Test ID: ${test.id} for attempt ID: ${payload.attemptId} failed validation. Successful calls: ${successfulCalls}/${this.evaluationNumAttempts}. Last error: ${lastError}`,
          );
        }

        await this.testResultService.create({
          attemptId: payload.attemptId,
          testId: test.id,
          is_valid: is_valid_output,
          compressed_prompt: compressed_prompt_output,
          compression_ratio: compression_ratio_output,
        });
        this.logger.log(
          `Created TestResult for attempt ID: ${payload.attemptId}, test ID: ${test.id} (Valid: ${is_valid_output}, Ratio: ${compression_ratio_output?.toFixed(3) ?? 'N/A'})`,
        );
      }
      this.logger.log(
        `Successfully processed compatible tests for attempt ID: ${payload.attemptId}`,
      );
    } catch (error) {
      this.logger.error(
        `Unexpected error in handleAttemptCreatedEvent for attempt ID: ${payload.attemptId}: ${(error as Error).message}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Decide if you need to rethrow or handle gracefully
    }
  }
}
