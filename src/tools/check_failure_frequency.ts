#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { evaluatePrompt } from '../lib/evaluate';
import type { TestCase } from '../lib/evaluate';

interface TestResults {
  failedOnAttempt: number[];
  passedAllAttempts: number;
  processedCount: number;
}

/**
 * Load test cases from the dataset file
 * @param datasetPath Path to the dataset file
 * @returns Array of test cases
 */
async function loadData(datasetPath: string): Promise<TestCase[]> {
  console.log(`Loading data from ${datasetPath}...`);
  const datasetContent = await fs.readFile(datasetPath, 'utf-8');
  const dataset = JSON.parse(datasetContent) as TestCase[];
  console.log(`Loaded ${dataset.length} test cases from dataset`);
  return dataset;
}

/**
 * Run tests on the dataset entries
 * @param testCases Array of test cases to process
 * @param numAttempts Number of attempts per entry
 * @param verbose Whether to print detailed progress for each entry
 * @returns Test results
 */
async function runTests(
  testCases: TestCase[], 
  numAttempts: number, 
  verbose: boolean = false
): Promise<TestResults> {
  // Initialize counters
  const failedOnAttempt = Array(numAttempts).fill(0); // Array of zeroes with length numAttempts
  let passedAllAttempts = 0;
  let processedCount = 0;
  
  console.log(`Processing ${testCases.length} entries using ${numAttempts} attempts per entry`);
  
  for (const testCase of testCases) {
    processedCount++;
    
    if (verbose) {
      console.log(`\nProcessing entry ${processedCount}/${testCases.length}: "${testCase.task.substring(0, 50)}..."`);
    }
    
    let allPassed = true;
    
    // Run each entry through the specified number of attempts
    for (let attempt = 1; attempt <= numAttempts; attempt++) {
      if (verbose) {
        console.log(`  Attempt ${attempt}...`);
      }
      
      const result = await evaluatePrompt({
        testCase: testCase,
        model: "openai/gpt-4o-mini"
      });
      
      if (!result) {
        if (verbose) {
          console.log(`  [FAIL] Failed on attempt ${attempt}`);
        }
        failedOnAttempt[attempt - 1]++;
        allPassed = false;
        break; // Don't continue with more attempts for this entry
      } else if (verbose) {
        console.log(`  [PASS] Passed attempt ${attempt}`);
      }
    }
    
    if (allPassed) {
      passedAllAttempts++;
      if (verbose) {
        console.log(`  [SUCCESS] Entry passed all ${numAttempts} attempts!`);
      }
    }
    
    // Progress report
    printProgressReport(processedCount, testCases.length, failedOnAttempt, passedAllAttempts, numAttempts);
  }
  
  // Add a newline after the status line
  console.log('\n');
  
  return { failedOnAttempt, passedAllAttempts, processedCount };
}

/**
 * Print progress report during test execution
 */
function printProgressReport(
  processedCount: number, 
  totalEntries: number, 
  failedOnAttempt: number[], 
  passedAllAttempts: number,
  numAttempts: number
): void {
  // Calculate percentages
  const progressPct = Math.round(processedCount/totalEntries*100);
  
  // Build failure percentages
  const failureStats = failedOnAttempt
    .map((count, i) => `Fail-${i+1}: ${count} (${Math.round(count/processedCount*100)}%)`)
    .join(' | ');
  
  const passPct = Math.round(passedAllAttempts/processedCount*100);
  
  // Create single-line status
  const status = `Progress: ${processedCount}/${totalEntries} (${progressPct}%) | ${failureStats} | Passed all: ${passedAllAttempts} (${passPct}%)`;
  
  // Clear line and print status
  process.stdout.write(`\r${' '.repeat(100)}\r${status}`);
}

/**
 * Print final report with test statistics
 * @param results Test results
 * @param totalEntries Total number of processed entries
 * @param numAttempts Number of attempts per entry
 */
function printReport(results: TestResults, totalEntries: number, numAttempts: number): void {
  const { failedOnAttempt, passedAllAttempts } = results;
  
  console.log('\n=== FINAL REPORT ===');
  console.log(`Total entries processed: ${totalEntries}`);
  
  // Display final stats for each attempt
  for (let i = 0; i < numAttempts; i++) {
    console.log(`- Failed on attempt ${i + 1}: ${failedOnAttempt[i]} (${Math.round(failedOnAttempt[i]/totalEntries*100)}%)`);
  }
  
  console.log(`- Passed all ${numAttempts} attempts: ${passedAllAttempts} (${Math.round(passedAllAttempts/totalEntries*100)}%)`);
}

async function main() {
  try {
    // Parse command line arguments
    const MAX_ENTRIES = process.env.MAX_ENTRIES ? parseInt(process.env.MAX_ENTRIES) : undefined;
    const NUM_ATTEMPTS = process.env.NUM_ATTEMPTS ? parseInt(process.env.NUM_ATTEMPTS) : 4;
    const VERBOSE = process.env.VERBOSE === 'true';
    
    if (NUM_ATTEMPTS < 1) {
      console.error('NUM_ATTEMPTS must be at least 1');
      process.exit(1);
    }
    
    // 1. Load data
    const datasetPath = path.resolve('data/processed/commonsense_qa_openai_gpt-4o-mini.json');
    const dataset = await loadData(datasetPath);
    
    // Determine entries to process
    const entriesToProcess = MAX_ENTRIES ? dataset.slice(0, MAX_ENTRIES) : dataset;
    
    // 2. Run tests
    const results = await runTests(entriesToProcess, NUM_ATTEMPTS, VERBOSE);
    
    // 3. Print final report
    printReport(results, entriesToProcess.length, NUM_ATTEMPTS);
    
  } catch (error) {
    console.error('Error running failure frequency check:', error);
    process.exit(1);
  }
}

main();