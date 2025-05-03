#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname, basename, extname, join } from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'glob'

// base input/output dirs
const DEV_DIR    = './data/mmlu/data/dev';
const OUT_DIR    = './data/parsed/mmlu';

// --- Pure parser --------------------------------------------------
/**
 * Parse one CSV line:
 * "Q,ansA,ansB,ansC,keyLetter"
 * → { question, options, correctAnswer }
 */
function parseLine(line) {
  const cols = line.split(',')
  if (cols.length < 3) {
    throw new Error(`Too few columns: ${line}`)
  }
  const question = cols[0].trim()
  const options  = cols.slice(1, -1).map(s => s.trim())
  const key      = cols[cols.length - 1].trim().toUpperCase()
  const idx = key.charCodeAt(0) - 65  // 'A'.charCodeAt(0) === 65
  if (idx < 0 || idx >= options.length) {
    throw new Error(`Invalid key “${key}” for [${options.join(', ')}]`)
  }
  return { question, options, correctAnswer: options[idx] }
}

// --- File I/O -----------------------------------------------------
async function processCsv(filePath) {
  const text  = await readFile(filePath, 'utf8')
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))

  const parsed = lines.map(parseLine)
  const name   = basename(filePath, extname(filePath)) + '.json'
  const outPath= join(OUT_DIR, name)

  await writeFile(outPath, JSON.stringify(parsed, null, 2), 'utf8')
  console.log(`✔ Parsed ${basename(filePath)} → ${join('data/parsed', name)}`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const pattern = join(DEV_DIR, '*.csv')
  const files = glob.sync(pattern)

  if (files.length === 0) {
    console.error(`❌ No CSV files found in ${DEV_DIR}`)
    process.exit(1)
  }

  for (const fp of files) {
    try {
      await processCsv(fp)
    } catch (err) {
      console.error(`✖ Failed on ${fp}:`, err.message)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
