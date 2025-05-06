#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises'
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';
import { filterFlakyTestCases } from '../lib/filter-flaky-cases.js';

const LIMIT_ENTRIES = 100;
const NUM_ATTEMPTS = 3;

const MODEL = 'openai/gpt-4o-mini';
const INPUT_PATH = 'data/parsed/commonsense_qa.json';
const OUTPUT_DIR = 'data/processed';
const OUTPUT_PATH = `${OUTPUT_DIR}/commonsense_qa_${MODEL.replaceAll('/', '_')}.json`;

async function main() {
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const raw = await readFile(INPUT_PATH, 'utf8');
    const items = JSON.parse(raw).slice(0, LIMIT_ENTRIES);
    
    console.log(`Starting to filter dataset with ${items.length} entries...`);
    console.log(`Using ${NUM_ATTEMPTS} attempts per test case to filter out flaky entries`);
    
    // Filter out flaky test cases
    const stableEntries = await filterFlakyTestCases({
      dataset: items,
      numAttempts: NUM_ATTEMPTS,
      model: MODEL
    });
    
    // Write the filtered dataset to the output file
    await writeFile(OUTPUT_PATH, JSON.stringify(stableEntries, null, 2), 'utf8');
    console.log(`\n✔ Wrote ${stableEntries.length} stable entries → ${OUTPUT_PATH}`);
    console.log(`Filtered out ${items.length - stableEntries.length} flaky entries (${Math.round((items.length - stableEntries.length) / items.length * 100)}%)`);
  } catch (err) {
    console.error('Error processing dataset:', err);
    process.exit(1);
  }
}

main();
