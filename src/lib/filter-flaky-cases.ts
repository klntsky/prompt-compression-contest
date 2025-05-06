import { TestCase, evaluatePrompt } from './evaluate';

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
 * Filter out flaky test cases from a dataset by running multiple attempts
 * @param params Parameters for filtering flaky test cases
 * @returns Filtered dataset with only non-flaky test cases
 */
export async function filterFlakyTestCases(
  params: {
    dataset: TestCase[];
    numAttempts?: number;
    model: string;
    verbose?: boolean;
  }
): Promise<TestCase[]> {
  const {
    dataset,
    numAttempts = 3,
    model,
    verbose = true
  } = params;

  const nonFlakyEntries: TestCase[] = [];
  let totalProcessed = 0;
  const failedOnAttempt = Array(numAttempts).fill(0);
  
  if (verbose) {
    console.log(`Filtering ${dataset.length} test cases using ${numAttempts} attempts per case`);
  }
  
  for (const entry of dataset) {
    totalProcessed++;
    
    // Use evaluatePrompt from evaluate.ts to test if the case is flaky
    const result = await evaluatePrompt({
      testCase: entry,
      attempts: numAttempts,
      model
    });
    
    if (result) {
      nonFlakyEntries.push(entry);
    } else {
      // If it failed, we don't know exactly which attempt it failed on from the current API
      // For now, increment the first attempt failure count
      failedOnAttempt[0]++;
    }
    
    if (verbose) {
      // Print progress report
      printProgressReport(
        totalProcessed, 
        dataset.length, 
        failedOnAttempt,
        nonFlakyEntries.length,
        numAttempts
      );
    }
    
    // Add a small delay between entries to be rate-limit friendly
    await new Promise(r => setTimeout(r, 500));
  }
  
  if (verbose) {
    console.log('\n');
  }
  
  return nonFlakyEntries;
}