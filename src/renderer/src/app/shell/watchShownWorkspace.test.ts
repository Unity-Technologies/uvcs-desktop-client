import { describe, expect, it } from 'vitest';
import type { WatchCoverage } from '@shared/api/workspaces';
import { watchShownWorkspace } from './watchShownWorkspace';

/** Main's side, answering each `watch` when the test says. */
function fakeWorkspaces() {
  const answers: ((coverage: WatchCoverage) => void)[] = [];
  const calls: string[] = [];
  return {
    calls,
    workspaces: {
      watch: (workspacePath: string): Promise<WatchCoverage> => {
        calls.push(`watch ${workspacePath}`);
        return new Promise((resolve) => answers.push(resolve));
      },
      unwatch: async (): Promise<void> => void calls.push('unwatch'),
    },
    /** Main answers the `index`th watch, and the answer is handed on. */
    answer: async (index: number, coverage: WatchCoverage): Promise<void> => {
      answers[index]!(coverage);
      await Promise.resolve();
    },
  };
}

describe('watchShownWorkspace', () => {
  it('hands on how much of the shown workspace is watched once main answers', async () => {
    const main = fakeWorkspaces();
    const coverages: WatchCoverage[] = [];
    watchShownWorkspace('/wk/a', main.workspaces, (coverage) => coverages.push(coverage));

    await main.answer(0, 'partial');
    expect(coverages).toEqual(['partial']);
    expect(main.calls).toEqual(['watch /wk/a']);
  });

  it('drops the answer of a watch stopped before main answered, and keeps the one of the watch after it', async () => {
    const main = fakeWorkspaces();
    const coverages: string[] = [];
    const stop = watchShownWorkspace('/wk/a', main.workspaces, (coverage) => coverages.push(`a ${coverage}`));
    stop();
    watchShownWorkspace('/wk/b', main.workspaces, (coverage) => coverages.push(`b ${coverage}`));

    await main.answer(0, 'partial');
    await main.answer(1, 'full');
    expect(coverages).toEqual(['b full']);
    expect(main.calls).toEqual(['watch /wk/a', 'unwatch', 'watch /wk/b']);
  });
});
