import OpenAI from 'openai';
import 'dotenv/config';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import stringify from 'fast-json-stable-stringify';

/**
 * Interface for a test case
 */
export interface TestCase {
  task: string;
  options: string[];
  correctAnswer: string;
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
  uncompressedResults: TestSuiteResult;
  compressedResults: TestSuiteResult;
  compressionUsage: OpenAI.CompletionUsage;
  compressionRatio: number;
  passRateDifference: number;
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
  await new Promise(r => setTimeout(r, 500));
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
      // Add a small delay between attempts to be rate-limit friendly
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, 1000));
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
 * Evaluates test cases with a model
 * @param params Parameters for test suite evaluation
 * @returns Test suite results
 */
export async function evaluatePromptOnTestSuite(params: {
  testCases: TestCase[];
  attemptsPerTest?: number;
  model: string;
}): Promise<TestSuiteResult> {
  const { testCases, attemptsPerTest = 1, model } = params;
  let passedTests = 0;
  const totalUsage: OpenAI.CompletionUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  for (let i = 0; i < testCases.length; i++) {
    const { passed, usage } = await evaluatePrompt({
      testCase: testCases[i],
      attempts: attemptsPerTest,
      model,
    });
    totalUsage.prompt_tokens += usage.prompt_tokens;
    totalUsage.completion_tokens += usage.completion_tokens;
    totalUsage.total_tokens += usage.total_tokens;
    if (passed) {
      passedTests++;
    }
    // Add a small delay between test cases to be rate-limit friendly
    if (i < testCases.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return {
    success: passedTests === testCases.length,
    passedTests,
    totalTests: testCases.length,
    totalUsage,
  };
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
  await new Promise(r => setTimeout(r, 500)); // Rate limit friendly
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

  // 1. Baseline evaluation
  const uncompressedResults = await evaluatePromptOnTestSuite({
    testCases,
    model: evaluationModel,
    attemptsPerTest,
  });

  // 2. Compress all tasks in parallel
  const compressionPromises = testCases.map(testCase =>
    getCompressedTask({
      task: testCase.task,
      compressingPrompt,
      model: compressionModel,
    })
  );

  const compressionActionResults = await Promise.all(compressionPromises);

  const compressedTestCases: TestCase[] = [];
  const compressionUsage: OpenAI.CompletionUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  for (let i = 0; i < testCases.length; i++) {
    const { compressedTask, usage } = compressionActionResults[i];
    compressedTestCases.push({
      ...testCases[i],
      task: compressedTask,
    });
    compressionUsage.prompt_tokens += usage.prompt_tokens;
    compressionUsage.completion_tokens += usage.completion_tokens;
    compressionUsage.total_tokens += usage.total_tokens;
  }

  // 3. Evaluate compressed tasks
  const compressedResults = await evaluatePromptOnTestSuite({
    testCases: compressedTestCases,
    model: evaluationModel,
    attemptsPerTest,
  });

  // 4. Calculate metrics
  const uncompressedPromptTokens = uncompressedResults.totalUsage.prompt_tokens;
  const compressedPromptTokens = compressedResults.totalUsage.prompt_tokens;
  const compressionRatio =
    uncompressedPromptTokens > 0
      ? (uncompressedPromptTokens - compressedPromptTokens) /
        uncompressedPromptTokens
      : 0;

  const uncompressedPassRate =
    uncompressedResults.passedTests / uncompressedResults.totalTests;
  const compressedPassRate =
    compressedResults.passedTests / compressedResults.totalTests;
  const passRateDifference = compressedPassRate - uncompressedPassRate;

  return {
    uncompressedResults,
    compressedResults,
    compressionUsage,
    compressionRatio,
    passRateDifference,
  };
}
