#!/usr/bin/env node
import fs from 'fs';
import { readParquet } from 'parquet-wasm';
import { tableFromIPC } from 'apache-arrow';
async function convertAndTransform(inputPath, outputPath) {
  // Read the Parquet file
  const parquetData = fs.readFileSync(inputPath);
  const parquetBytes = new Uint8Array(parquetData);
  // Initialize WASM and parse the Parquet into an Arrow table
  const wasmTable = readParquet(parquetBytes);
  const ipcStream = wasmTable.intoIPCStream();
  const arrowTable = tableFromIPC(ipcStream);
  // Pull out plain JS row objects
  const rows = arrowTable.toArray();
  // Transform into { task, options, correctAnswer }
  const transformed = rows.map(({ question, choices, answerKey }) => {
    const idx = choices.label.indexOf(answerKey);
    const correctAnswer = choices.text.get(idx);
    return {
      task: question,
      options: choices.text,
      correctAnswer,
    };
  });
  // Write the output JSON
  fs.writeFileSync(outputPath, JSON.stringify(transformed, null, 2), 'utf8');
}
(async () => {
  // const [,, inputPath, outputPath] = process.argv;
  const inputPath = './data/commonsense_qa/train.parquet';
  const outputPath = './data/parsed/commonsense_qa.json';
  if (!inputPath || !outputPath) {
    console.error(
      'Usage: node convertAndTransformParquet.js <input.parquet> <output.json>'
    );
    process.exit(1);
  }
  try {
    await convertAndTransform(inputPath, outputPath);
    console.log(`✔ Converted & transformed ${inputPath} → ${outputPath}`);
  } catch (err) {
    console.error('Error during conversion:', err);
    process.exit(1);
  }
})();
