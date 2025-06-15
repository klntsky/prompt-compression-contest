import { startTasker } from '../lib/tasker';

async function main() {
  await startTasker();
}

main().catch(error => {
  console.error('Tasker failed to start:', error);
  process.exit(1);
});
