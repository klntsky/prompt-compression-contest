import OpenAI from 'openai';
import 'dotenv/config';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import stringify from 'fast-json-stable-stringify';

/**
 * Interface for a test case
 */
export interface TestCase {
  id: number;
  task: string;
  options: string[];
  correctAnswer: string;
  compressionUsage: OpenAI.CompletionUsage;
  compressionRatio: number;
  compressedTask: string;
  requestJson: string;
}

/**
 * Interface for the result of a single model answer call
 */
export interface ModelAnswerResult {
  answer: string;
  usage: OpenAI.CompletionUsage;
  requestJson: string;
}

/**
 * Interface for the result of a single test evaluation
 */
export interface EvaluationResult {
  passed: boolean;
  usage: OpenAI.CompletionUsage;
  requestJson?: string;
}

/**
 * Interface for the result of a per-test compression evaluation
 */
export interface TestCompressionResult {
  testCase: TestCase;
  uncompressedResult: EvaluationResult;
  compressedResult: EvaluationResult;
  compressionUsage: OpenAI.CompletionUsage;
  compressionRatio: number;
  compressedTask: string;
  requestJson: string;
}

/**
 * Interface for the test suite results
 */
export interface TestSuiteResult {
  success: boolean;
  passedTests: number;
  totalTests: number;
  totalUsage: OpenAI.CompletionUsage;
}

/**
 * Interface for the compression evaluation results
 */
export interface CompressionEvalResult {
  results: TestCompressionResult[];
  uncompressedResults: TestSuiteResult;
  compressedResults: TestSuiteResult;
  compressionUsage: OpenAI.CompletionUsage;
  averageCompressionRatio: number;
}

/**
 * Creates and configures an OpenAI client with OpenRouter
 * @returns {OpenAI} Configured OpenAI client
 */
function createOpenAIClient(): OpenAI {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || '',
      'X-Title': process.env.OPENROUTER_X_TITLE || '',
    },
  });
}

/**
 * Build the tool schema for a given set of options
 * @param options List of answer options
 * @returns Function calling tools for the options
 */
function buildAnswerQuestionTools(params: {
  options: string[];
}): OpenAI.ChatCompletionTool[] {
  const { options } = params;
  return [
    {
      type: 'function',
      function: {
        strict: true,
        name: 'answer_question',
        description: 'Return exactly one of the provided options',
        parameters: {
          type: 'object',
          properties: {
            answer: { type: 'string', enum: options },
          },
          required: ['answer'],
          additionalProperties: false,
        },
      },
    },
  ];
}

/**
 * Makes an API call and gets the model's answer for a task
 * @param params Parameters for getting a model answer
 * @returns The model's answer string
 * @throws {Error} If the model doesn't provide a valid tool call response
 */
async function getModelAnswer(params: {
  task: string;
  options: string[];
  model: string;
}): Promise<ModelAnswerResult> {
  const { task, options, model } = params;
  const openai = createOpenAIClient();
  const tools = buildAnswerQuestionTools({ options });
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: "Answer user's question by calling answer_question function",
    },
    { role: 'user', content: task },
  ];
  const requestPayload = {
    model,
    messages,
    tools,
    tool_choice: {
      type: 'function',
      function: { name: 'answer_question' },
    } as const,
  };
  const response = await openai.chat.completions.create(requestPayload);
  const toolCall = response?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.error(response, options);
    throw new Error('No tool call in response');
  }
  if (!response.usage) {
    throw new Error('No usage stats in response');
  }
  const args = JSON.parse(toolCall.function.arguments);
  return {
    answer: args.answer,
    usage: response.usage,
    requestJson: stringify(requestPayload),
  };
}

/**
 * Compare two answers case-insensitively
 * @param params Parameters for comparing answers
 * @returns Whether the answers match
 */
function isCorrect(params: { answer: string; correctAnswer: string }): boolean {
  const { answer, correctAnswer } = params;
  return answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}

/**
 * Evaluates a test case using a model
 * @param params Parameters for test evaluation
 * @returns Whether the test passed all attempts and token counts
 */
export async function evaluatePrompt(params: {
  testCase: TestCase;
  attempts?: number;
  model: string;
}): Promise<EvaluationResult> {
  const { testCase, attempts = 1, model } = params;
  const { task, options, correctAnswer } = testCase;
  const totalUsage: OpenAI.CompletionUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  let lastRequestJson: string | undefined;
  try {
    for (let i = 0; i < attempts; i++) {
      try {
        const { answer, usage, requestJson } = await getModelAnswer({
          task,
          options,
          model,
        });
        lastRequestJson = requestJson;
        totalUsage.prompt_tokens += usage.prompt_tokens;
        totalUsage.completion_tokens += usage.completion_tokens;
        totalUsage.total_tokens += usage.total_tokens;
        if (!isCorrect({ answer, correctAnswer })) {
          return { passed: false, usage: totalUsage, requestJson };
        }
      } catch (error) {
        console.error('Error getting model answer:', (error as Error).message);
        return {
          passed: false,
          usage: totalUsage,
          requestJson: lastRequestJson,
        };
      }
    }
    return { passed: true, usage: totalUsage, requestJson: lastRequestJson };
  } catch (error) {
    console.error(
      'Error during evaluation:',
      (error as Error).message || error
    );
    return { passed: false, usage: totalUsage, requestJson: lastRequestJson };
  }
}

/**
 * Compresses a given text using a model and a prompt
 * @param params Parameters for compressing text
 * @returns The compressed text and the token usage for the compression
 */
export async function getCompressedTask(params: {
  task: string;
  compressingPrompt: string;
  model: string;
}): Promise<{
  compressedTask: string;
  usage: OpenAI.CompletionUsage;
  requestJson: string;
}> {
  const { task, compressingPrompt, model } = params;
  const openai = createOpenAIClient();
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: compressingPrompt },
    { role: 'user', content: task },
  ];
  const requestPayload = {
    model,
    messages,
  };
  const response = await openai.chat.completions.create(requestPayload);

  const compressedTask = response.choices[0]?.message?.content;
  if (!compressedTask) {
    throw new Error('Failed to get compressed task from model.');
  }
  if (!response.usage) {
    throw new Error('No usage data in compression response');
  }

  return {
    compressedTask,
    usage: response.usage,
    requestJson: stringify(requestPayload),
  };
}

/**
 * Evaluates a compressing prompt by testing it against a test suite
 * and calculating the compression ratio and impact on performance.
 * @param params Parameters for evaluating the compression
 * @returns A detailed result of the compression evaluation
 */
export async function evaluateCompression(params: {
  testCases: TestCase[];
  compressingPrompt: string;
  compressionModel: string;
  evaluationModel: string;
  attemptsPerTest?: number;
}): Promise<CompressionEvalResult> {
  const {
    testCases,
    compressingPrompt,
    compressionModel,
    evaluationModel,
    attemptsPerTest = 1,
  } = params;

  const results: TestCompressionResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    // 1. Evaluate uncompressed and compress task in parallel
    const [uncompressedResult, compressionOutput] = await Promise.all([
      evaluatePrompt({
        testCase,
        model: evaluationModel,
        attempts: attemptsPerTest,
      }),
      getCompressedTask({
        task: testCase.task,
        compressingPrompt,
        model: compressionModel,
      }),
    ]);

    const {
      compressedTask,
      usage: compressionUsage,
      requestJson: compressionRequestJson,
    } = compressionOutput;

    const compressedTestCase: TestCase = {
      ...testCase,
      task: compressedTask,
    };

    // 2. Evaluate compressed task
    const compressedResult = await evaluatePrompt({
      testCase: compressedTestCase,
      model: evaluationModel,
      attempts: attemptsPerTest,
    });

    // 3. Calculate metrics for this test case
    const uncompressedPromptTokens = uncompressedResult.usage.prompt_tokens;
    const compressedPromptTokens = compressedResult.usage.prompt_tokens;
    const compressionRatio =
      uncompressedPromptTokens > 0
        ? uncompressedPromptTokens / compressedPromptTokens
        : 0;

    const requests = {
      compression: JSON.parse(compressionRequestJson),
      evaluationUncompressed: uncompressedResult.requestJson
        ? JSON.parse(uncompressedResult.requestJson)
        : null,
      evaluationCompressed: compressedResult.requestJson
        ? JSON.parse(compressedResult.requestJson)
        : null,
    };

    results.push({
      testCase,
      uncompressedResult,
      compressedResult,
      compressionUsage,
      compressionRatio,
      compressedTask,
      requestJson: stringify(requests),
    });
  }

  // 4. Aggregate results
  const totalTests = testCases.length;
  let uncompressedPassedTests = 0;
  let compressedPassedTests = 0;
  const uncompressedTotalUsage: OpenAI.CompletionUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  const compressedTotalUsage: OpenAI.CompletionUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  const totalCompressionUsage: OpenAI.CompletionUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  let totalCompressionRatio = 0;
  let passedBothCount = 0;

  for (const result of results) {
    if (result.uncompressedResult.passed) uncompressedPassedTests++;
    if (result.compressedResult.passed) compressedPassedTests++;
    if (result.uncompressedResult.passed && result.compressedResult.passed) {
      totalCompressionRatio += result.compressionRatio;
      passedBothCount++;
    }

    uncompressedTotalUsage.prompt_tokens +=
      result.uncompressedResult.usage.prompt_tokens;
    uncompressedTotalUsage.completion_tokens +=
      result.uncompressedResult.usage.completion_tokens;
    uncompressedTotalUsage.total_tokens +=
      result.uncompressedResult.usage.total_tokens;

    compressedTotalUsage.prompt_tokens +=
      result.compressedResult.usage.prompt_tokens;
    compressedTotalUsage.completion_tokens +=
      result.compressedResult.usage.completion_tokens;
    compressedTotalUsage.total_tokens +=
      result.compressedResult.usage.total_tokens;

    totalCompressionUsage.prompt_tokens +=
      result.compressionUsage.prompt_tokens;
    totalCompressionUsage.completion_tokens +=
      result.compressionUsage.completion_tokens;
    totalCompressionUsage.total_tokens += result.compressionUsage.total_tokens;
  }

  const uncompressedResults: TestSuiteResult = {
    success: uncompressedPassedTests === totalTests,
    passedTests: uncompressedPassedTests,
    totalTests,
    totalUsage: uncompressedTotalUsage,
  };

  const compressedResults: TestSuiteResult = {
    success: compressedPassedTests === totalTests,
    passedTests: compressedPassedTests,
    totalTests,
    totalUsage: compressedTotalUsage,
  };

  const averageCompressionRatio =
    passedBothCount > 0 ? totalCompressionRatio / passedBothCount : 0;

  return {
    results,
    uncompressedResults,
    compressedResults,
    compressionUsage: totalCompressionUsage,
    averageCompressionRatio,
  };
}
