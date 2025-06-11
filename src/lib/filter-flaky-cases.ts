import { TestCase, evaluatePrompt, TestCaseResult } from './evaluate';

/**
 * Print progress report during test execution
 */
function printProgressReport(
  processedCount: number,
  totalEntries: number,
  failedOnAttempt: number[],
  passedAllAttempts: number,
  _numAttempts: number
): void {
  // Calculate percentages
  const progressPct = Math.round((processedCount / totalEntries) * 100);
  // Build failure percentages
  const failureStats = failedOnAttempt
    .map(
      (count, i) =>
        `Fail-${i + 1}: ${count} (${Math.round((count / processedCount) * 100)}%)`
    )
    .join(' | ');
  const passPct = Math.round((passedAllAttempts / processedCount) * 100);
  // Create single-line status
  const status = `Progress: ${processedCount}/${totalEntries} (${progressPct}%) | ${failureStats} | Passed all: ${passedAllAttempts} (${passPct}%)`;
  // Clear line and print status
  process.stdout.write(`\r${' '.repeat(status.length)}\r${status}`);
}

/**
 * Filter out flaky test cases from a dataset by running multiple attempts
 * @param params Parameters for filtering flaky test cases
 * @returns Filtered dataset with only non-flaky test cases
 */
export async function filterFlakyTestCases(params: {
  dataset: TestCase[];
  numAttempts?: number;
  model: string;
  verbose?: boolean;
}): Promise<TestCaseResult[]> {
  const { dataset, numAttempts = 3, model, verbose = true } = params;
  const filteredTestCaseResults: TestCaseResult[] = [];
  let totalProcessed = 0;
  const failedOnAttempt = Array(numAttempts).fill(0);
  if (verbose) {
    console.log(
      `Filtering ${dataset.length} test cases using ${numAttempts} attempts per case`
    );
  }
  for (const entry of dataset) {
    // Use evaluatePrompt from evaluate.ts to test if the case is flaky
    const result = await evaluatePrompt({
      testCase: entry,
      attempts: numAttempts,
      model,
    });
    totalProcessed++;
    if (result?.passed) {
      filteredTestCaseResults.push({ testCase: entry, result: result });
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
        filteredTestCaseResults.length,
        numAttempts
      );
    }
  }
  if (verbose) {
    console.log();
  }
  return filteredTestCaseResults;
}
