#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { filterFlakyTestCases } from '../lib/filter-flaky-cases';
import type { TestCase } from '../lib/evaluate';
import 'dotenv/config';
import _ from 'lodash';

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
 * Take a random sample from an array
 * @param array The array to sample from
 * @param size The size of the sample
 * @returns A random sample of the specified size
 */
function getRandomSample<T>(array: T[], size: number): T[] {
  return _.sampleSize(array, Math.min(size, array.length));
}

/**
 * Combine arrays and remove duplicates using deep equality
 * @param arrays Arrays to combine
 * @returns Combined array with duplicates removed
 */
function combineAndDedup<T>(arrays: T[][]): T[] {
  const combined = arrays.flat();
  const result: T[] = [];
  
  for (const item of combined) {
    if (!result.some(existingItem => _.isEqual(existingItem, item))) {
      result.push(item);
    }
  }
  
  return result;
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
  
  const outputFile = path.join(OUTPUT_DIR, `${datasetName}.${model.split('/').pop()}.${numAttempts}_attempts.json`);  
  
  try {
    const content = await fs.readFile(inputFile, 'utf-8');
    const dataset = JSON.parse(content) as TestCase[];
    
    console.log(`Read ${dataset.length} entries from ${inputFile}`);
    
    // Take a random sample instead of first N entries
    const sampledDataset = getRandomSample(dataset, limitEntries);
    console.log(`Randomly sampled ${sampledDataset.length} entries from dataset`);
    
    // Use a single call to filterFlakyTestCases instead of chunking by one
    const nonFlakyEntries = await filterFlakyTestCases({
      dataset: sampledDataset,
      numAttempts: numAttempts,
      model: model,
      verbose: true
    });
    
    // Print status at the end
    printStatus(sampledDataset.length, sampledDataset.length, nonFlakyEntries.length);

    // Check if output file exists and combine with existing data
    let existingEntries: TestCase[] = [];
    try {
      const existingContent = await fs.readFile(outputFile, 'utf-8');
      existingEntries = JSON.parse(existingContent) as TestCase[];
      console.log(`Found ${existingEntries.length} existing entries in ${outputFile}`);
    } catch (error) {
      // File doesn't exist or can't be read, proceed with empty array
      console.log(`No existing file found at ${outputFile}, will create new file`);
    }
    
    // Combine new entries with existing ones and remove duplicates
    const combinedEntries = combineAndDedup([existingEntries, nonFlakyEntries]);
    
    // Create output directory if it doesn't exist
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, JSON.stringify(combinedEntries, null, 2), 'utf-8');

    console.log(`✅ Successfully processed ${datasetName}`);
    console.log(`Filtered ${sampledDataset.length - nonFlakyEntries.length} flaky entries (${Math.round((sampledDataset.length - nonFlakyEntries.length) / sampledDataset.length * 100)}%)`);
    console.log(`Combined with ${existingEntries.length} existing entries, removed ${existingEntries.length + nonFlakyEntries.length - combinedEntries.length} duplicates`);
    console.log(`Wrote ${combinedEntries.length} entries to ${outputFile}`);
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