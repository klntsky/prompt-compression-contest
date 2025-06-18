import { startTasker } from '../lib/tasker';
import AppDataSource from '../api/data-source';
import { evaluateCompression } from '@/lib/evaluate';

async function main() {
  await AppDataSource.initialize();
  await startTasker(evaluateCompression);
}

main().catch(error => {
  console.error('Tasker failed to start:', error);
  process.exit(1);
});
