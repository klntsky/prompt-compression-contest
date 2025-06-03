#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { basename, extname, join } from 'path';
import { glob } from 'glob';
import { stringify } from 'fast-json-stable-stringify';

// base input/output dirs
const DEV_DIR = './data/mmlu/data/dev';
const OUT_DIR = './data/parsed';
const OUT_FILE = join(OUT_DIR, 'mmlu.json');

// --- Pure parser --------------------------------------------------
/**
 * Parse one CSV line:
 * "Q,ansA,ansB,ansC,keyLetter"
 * → { question, options, correctAnswer }
 */
function parseLine(line) {
  const cols = line.split(',');
  if (cols.length < 3) {
    throw new Error(`Too few columns: ${line}`);
  }
  const question = cols[0].trim();
  const options = cols.slice(1, -1).map(s => s.trim());
  const key = cols[cols.length - 1].trim().toUpperCase();
  const idx = key.charCodeAt(0) - 65; // 'A'.charCodeAt(0) === 65
  if (idx < 0 || idx >= options.length) {
    return []; // throw new Error(`Invalid key "${key}" for [${options.join(', ')}]`)
  }
  // Filter out bad data not compatible with openai strict mode.
  if (options.some(o => o.includes('"'))) {
    return [];
  }
  return [{ task: question, options, correctAnswer: options[idx] }];
}

// --- File I/O -----------------------------------------------------
async function processCsv(filePath) {
  const text = await readFile(filePath, 'utf8');
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
  return lines.flatMap(parseLine);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const pattern = join(DEV_DIR, '*.csv');
  const files = glob.sync(pattern);
  if (files.length === 0) {
    console.error(`❌ No CSV files found in ${DEV_DIR}`);
    process.exit(1);
  }
  let allParsedData = [];
  for (const fp of files) {
    try {
      const categoryData = await processCsv(fp);
      const categoryName = basename(fp, extname(fp));
      console.log(
        `✔ Parsed ${categoryName}: ${categoryData.length} questions`
      );
      allParsedData = allParsedData.concat(categoryData);
    } catch (err) {
      console.error(`✖ Failed on ${fp}:`, err.message);
    }
  }
  // Write all data to a single file
  await writeFile(OUT_FILE, stringify(allParsedData), 'utf8');
  console.log(
    `✔ Wrote ${allParsedData.length} total questions to ${OUT_FILE}`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
