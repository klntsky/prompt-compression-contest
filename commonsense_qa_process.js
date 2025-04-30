#!/usr/bin/env node
import OpenAI from 'openai'
import { readFile, writeFile, mkdir } from 'fs/promises'
import 'dotenv/config';

const LIMIT_ENTRIES = 100;

// —— Pure helper functions (no I/O) ——

/**
 * Build the tool schema for a given set of options
 * @param {string[]} options
 * @returns {object[]}
 */
function buildTools(options) {
  return [
    {
      type: 'function',
      function: {
        name: 'answer_question',
        description: 'Return exactly one of the provided options',
        parameters: {
          type: 'object',
          properties: {
            answer: { type: 'string', enum: options }
          },
          required: ['answer']
        }
      }
    }
  ];
}

/**
 * Extract the answer string from a tool_call object
 * @param {object} toolCall
 * @returns {string}
 */
function extractAnswer(toolCall) {
  const args = JSON.parse(toolCall.function.arguments);
  return args.answer;
}

/**
 * Compare two answers case-insensitively
 * @param {string} answer
 * @param {string} correctAnswer
 * @returns {boolean}
 */
function isCorrect(answer, correctAnswer) {
  return answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}

// —— Main I/O and orchestration ——

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.HTTP_REFERER || '',
    'X-Title':     process.env.X_TITLE     || '',
  },
});

const MODEL       = 'openai/gpt-4o-mini';
const INPUT_PATH  = 'data/parsed/commonsense_qa.json';
const OUTPUT_DIR  = 'data/processed';
const OUTPUT_PATH = `${OUTPUT_DIR}/commonsense_qa_${MODEL.replaceAll('/', '_')}.json`;

async function main() {

  await mkdir(OUTPUT_DIR, { recursive: true });
  const raw   = await readFile(INPUT_PATH, 'utf8');
  const items = JSON.parse(raw).slice(0, LIMIT_ENTRIES);
  const correct = [];

  for (let i = 0; i < items.length; i++) {
    const { task, options, correctAnswer } = items[i];
    console.log(`\n[${i+1}/${items.length}] ${task}`);
    console.log('  options:', options);

    const tools = buildTools(options);

    try {
      const res = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You must reply by invoking the tool with only the chosen answer.' },
          { role: 'user',   content: task }
        ],
        tools,
        tool_choice: { function: {name: 'answer_question'}, type: 'function' }
      });

      const toolCall = res.choices[0].message.tool_calls[0];
      const answer = extractAnswer(toolCall);
      const ok = isCorrect(answer, correctAnswer);

      console.log('  model answer:  ', answer);
      console.log('  correct answer:', correctAnswer);
      console.log('  ✓ correct?     ', ok);

      if (ok) correct.push(items[i]);
    }
    catch (err) {
      console.error('  ❗ error on question', i+1, err.message || err);
    }

    // rate-limit friendly pause
    await new Promise(r => setTimeout(r, 500));
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(correct, null, 2), 'utf8');
  console.log(`\n✔ Wrote ${correct.length} correct answers → ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
