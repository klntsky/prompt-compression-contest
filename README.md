# prompt-compression-contest

The idea:

1. build a dataset for prompts that do some task reliably, with test cases for each task,
2. invite users to submit prompts that compress other prompts (less tokens -> better)
3. Use the dataset to measure performance of rewritten prompts
4. The prompt that compresses other prompts most efficiently wins the leaderboard.

# Using

`pnpm run build`

## Building the dataset

```
LIMIT_ENTRIES=5 NUM_ATTEMPTS=3 MODEL=openai/gpt-4o-mini pnpm run build:dataset
```
