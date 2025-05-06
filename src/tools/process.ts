#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { filterFlakyTestCases } from '../lib/filter-flaky-cases';
import type { TestCase } from '../lib/evaluate';
import 'dotenv/config';

// Configuration
const INPUT_DIR = 'data/parsed';
const OUTPUT_DIR = 'data/processed';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const MODEL = process.env.MODEL || DEFAULT_MODEL;
const NUM_ATTEMPTS = process.env.NUM_ATTEMPTS ? parseInt(process.env.NUM_ATTEMPTS) : 3;
const LIMIT_ENTRIES = process.env.LIMIT_ENTRIES ? parseInt(process.env.LIMIT_ENTRIES) : 100;

/**
 * Print a single-line status update
 * @param processedCount Number of entries processed so far
 * @param totalEntries Total number of entries to process
 * @param passedEntries Number of entries that passed filtering
 */
function printStatus(
  processedCount: number, 
  totalEntries: number, 
  passedEntries: number
): void {
  // Calculate percentages
  const progressPct = Math.round(processedCount / totalEntries * 100);
  const passPct = processedCount > 0 ? Math.round(passedEntries / processedCount * 100) : 0;
  const failPct = processedCount > 0 ? Math.round((processedCount - passedEntries) / processedCount * 100) : 0;
  console.log(`Progress: ${processedCount}/${totalEntries} (${progressPct}%) | Passed: ${passedEntries} (${passPct}%) | Failed: ${processedCount - passedEntries} (${failPct}%)`);
}

/**
 * Process a single dataset file
 * @param inputFile Path to the input file
 * @param model Model to use for evaluation
 * @param numAttempts Number of attempts per test case
 * @param limitEntries Maximum number of entries to process
 */
async function processFile(
  inputFile: string, 
  model: string,
  numAttempts: number,
  limitEntries: number
): Promise<void> {
  // Extract dataset name from file path
  const datasetName = path.basename(inputFile, '.json');
  console.log(`\nProcessing dataset: ${datasetName}`);
  
  const outputFile = path.join(OUTPUT_DIR, `${datasetName}.${model.split('/').pop()}.json`);  
  
  try {
    const content = await fs.readFile(inputFile, 'utf-8');
    const dataset = JSON.parse(content) as TestCase[];
    
    console.log(`Read ${dataset.length} entries from ${inputFile}`);
    
    const limitedDataset = dataset.slice(0, limitEntries);
    if (limitedDataset.length < dataset.length) {
      console.log(`Limiting to first ${limitEntries} entries`);
    }
    
    // Use a single call to filterFlakyTestCases instead of chunking by one
    const nonFlakyEntries = await filterFlakyTestCases({
      dataset: limitedDataset,
      numAttempts: numAttempts,
      model: model,
      verbose: true
    });
    
    // Print status at the end
    printStatus(limitedDataset.length, limitedDataset.length, nonFlakyEntries.length);

    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, JSON.stringify(nonFlakyEntries, null, 2), 'utf-8');

    console.log(`✅ Successfully processed ${datasetName}`);
    console.log(`Filtered ${limitedDataset.length - nonFlakyEntries.length} flaky entries (${Math.round((limitedDataset.length - nonFlakyEntries.length) / limitedDataset.length * 100)}%)`);
    console.log(`Wrote ${nonFlakyEntries.length} entries to ${outputFile}`);
  } catch (error) {
    console.error(`❌ Failed to process ${datasetName}:`, error);
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    // Find all JSON files in the input directory
    const inputFiles = await glob(path.join(INPUT_DIR, '*.json'));
    
    if (inputFiles.length === 0) {
      console.error(`No JSON files found in ${INPUT_DIR}`);
      process.exit(1);
    }
    
    // Get model from environment or use default
    const model = MODEL;
    
    console.log(`Found ${inputFiles.length} dataset files to process`);
    console.log(`Using model: ${model}`);
    console.log(`Using ${NUM_ATTEMPTS} attempts per test case`);

    for (const inputFile of inputFiles) {
      await processFile(inputFile, model, NUM_ATTEMPTS, LIMIT_ENTRIES);
    }

    console.log('All datasets processed successfully!');
  } catch (error) {
    console.error('Error during processing:', error);
    process.exit(1);
  }
}

// Run the script
main(); 