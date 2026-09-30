import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * How the test files run. Each file pays a start-up cost before its tests (a fresh module graph, read from disk), which
 * dominates on CI's 2-CPU Linux and Windows runners: vitest's default of one worker per CPU but one ran those files one
 * at a time. Threads start cheaper than the default forks, and a second worker overlaps one file's start-up with
 * another's run; timed on every runner, this halves the Windows arm64 run (219 s → 98 s). A third worker on 2 CPUs
 * made Windows x64 slower again. `isolate: false` was rejected: tests leak state into each other and hundreds fail.
 */
const TEST_WORKERS = Math.max(2, availableParallelism() - 1);

export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  test: {
    // scripts/build: the build's own logic (the third-party notices, the dependency license check).
    include: ['src/**/*.test.ts', 'scripts/build/**/*.test.ts'],
    globalSetup: ['vitest.tempDirectory.ts'],
    pool: 'threads',
    maxWorkers: TEST_WORKERS,
  },
});
