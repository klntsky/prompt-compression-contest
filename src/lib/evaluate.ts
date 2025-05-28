import OpenAI from 'openai';
import 'dotenv/config';

/**
 * Interface for a test case
 */
export interface TestCase {
  task: string;
  options: string[];
  correctAnswer: string;
}

/**
 * Interface for the test suite results
 */
export interface TestSuiteResult {
  success: boolean;
  passedTests: number;
  totalTests: number;
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
}): Promise<string> {
  const { task, options, model } = params;
  const openai = createOpenAIClient();
  const tools = buildAnswerQuestionTools({ options });
  await new Promise(r => setTimeout(r, 500));
  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: "Answer user's question by calling answer_question function",
      },
      { role: 'user', content: task },
    ],
    tools,
    tool_choice: { type: 'function', function: { name: 'answer_question' } },
  });
  const toolCall = response?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.error(response, options);
    throw new Error('No tool call in response');
  }
  const args = JSON.parse(toolCall.function.arguments);
  return args.answer;
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
 * @returns Whether the test passed all attempts
 */
export async function evaluatePrompt(params: {
  testCase: TestCase;
  attempts?: number;
  model: string;
}): Promise<boolean> {
  const { testCase, attempts = 1, model } = params;
  const { task, options, correctAnswer } = testCase;
  try {
    for (let i = 0; i < attempts; i++) {
      try {
        const answer = await getModelAnswer({
          task,
          options,
          model,
        });
        if (!isCorrect({ answer, correctAnswer })) {
          return false;
        }
      } catch (error) {
        console.error('Error getting model answer:', (error as Error).message);
        return false;
      }
      // Add a small delay between attempts to be rate-limit friendly
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    return true;
  } catch (error) {
    console.error(
      'Error during evaluation:',
      (error as Error).message || error
    );
    return false;
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
  for (let i = 0; i < testCases.length; i++) {
    const result = await evaluatePrompt({
      testCase: testCases[i],
      attempts: attemptsPerTest,
      model,
    });
    if (result) {
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
  };
}
