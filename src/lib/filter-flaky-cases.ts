import { TestCase, evaluatePrompt } from './evaluate';
import 'dotenv/config';

/**
 * Filter out flaky test cases from a dataset by running multiple attempts
 * @param params Parameters for filtering flaky test cases
 * @returns Filtered dataset with only non-flaky test cases
 */
export async function filterFlakyTestCases(
  params: {
    dataset: TestCase[];
    numAttempts?: number;
    model?: string;
    verbose?: boolean;
  }
): Promise<TestCase[]> {
  const {
    dataset,
    numAttempts = 3,
    model = 'openai/gpt-4o-mini',
    verbose = true
  } = params;

  const nonFlakyEntries: TestCase[] = [];
  
  if (verbose) {
    console.log(`Filtering ${dataset.length} test cases using ${numAttempts} attempts per case`);
  }
  
  let totalProcessed = 0;
  
  for (const entry of dataset) {
    totalProcessed++;
    
    if (verbose) {
      process.stdout.write(`\r${' '.repeat(100)}\r[${totalProcessed}/${dataset.length}] Testing: ${entry.task.substring(0, 40)}...`);
    }
    
    // Use evaluatePrompt from evaluate.ts to test if the case is flaky
    const result = await evaluatePrompt({
      testCase: entry,
      attempts: numAttempts,
      model
    });
    
    if (result) {
      nonFlakyEntries.push(entry);
      if (verbose) {
        process.stdout.write(` [PASS]`);
      }
    } else if (verbose) {
      process.stdout.write(` [FAIL]`);
    }
    
    // Add a small delay between entries to be rate-limit friendly
    await new Promise(r => setTimeout(r, 500));
  }
  
  if (verbose) {
    console.log(`\n\nFiltering complete. ${nonFlakyEntries.length}/${dataset.length} test cases passed all ${numAttempts} attempts (${Math.round(nonFlakyEntries.length/dataset.length*100)}%)`);
  }
  
  return nonFlakyEntries;
} 