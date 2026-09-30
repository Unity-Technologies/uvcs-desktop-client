import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandProgress, OperationProgress } from '@shared/domain/operation';
import type { ProgressReader } from '../cm/progress/progressReader';
import { OperationTracker, type OperationContext } from './OperationTracker';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function tracker() {
  const reports: OperationProgress[] = [];
  const started: Promise<unknown>[] = [];
  const operations = new OperationTracker(
    (_operationId, progress) => reports.push(progress),
    (finished) => started.push(finished),
  );
  return { operations, reports, started };
}

/** Reads lines like `downloading 3/10` into progress; other lines tell nothing new. */
const downloads: ProgressReader = (previous, line) => {
  const match = /^(\w+) (\d+)\/(\d+)$/.exec(line);
  if (!match) return previous;
  const [, stageLabel, current, total] = match;
  return { stage: 'downloading', stageLabel: stageLabel!, current: Number(current), total: Number(total), fraction: Number(current) / Number(total) };
};

/** An operation that runs until the test ends it, handing its context out. */
function started(run: (work: (context: OperationContext) => Promise<string>) => Promise<string>) {
  let context!: OperationContext;
  let finish!: (value: string) => void;
  let fail!: (error: Error) => void;
  const result = run((given) => {
    context = given;
    return new Promise<string>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
  });
  return { context, result, finish, fail };
}

describe('OperationTracker', () => {
  it("reports a command's progress as its reader reads it, at most ten times a second", async () => {
    const { operations, reports } = tracker();
    const { context, result, finish } = started((work) => operations.run('update-1', work));
    const onLine = context.progressOf(downloads);

    for (let file = 1; file <= 50; file++) onLine(`downloading ${file}/50`);
    expect(reports.map((progress) => progress.current)).toEqual([1]);

    vi.advanceTimersByTime(100);
    expect(reports.map((progress) => progress.current)).toEqual([1, 50]);

    finish('done');
    expect(await result).toBe('done');
  });

  it('reports a new stage at once, and the last numbers when the operation ends', async () => {
    const { operations, reports } = tracker();
    const { context, result, finish } = started((work) => operations.run('update-1', work));
    const onLine = context.progressOf(downloads);

    onLine('downloading 1/2');
    onLine('downloading 2/2');
    onLine('applying 1/2');
    onLine('applying 2/2');
    finish('done');
    await result;

    expect(reports.map(({ stageLabel, current }) => `${stageLabel} ${current}`)).toEqual(['downloading 1', 'applying 1', 'applying 2']);
  });

  it("doesn't report lines that tell nothing new", () => {
    const { operations, reports } = tracker();
    const { context } = started((work) => operations.run('update-1', work));
    const onLine = context.progressOf(downloads);

    onLine('downloading 1/2');
    onLine('Contacting the server…');
    vi.advanceTimersByTime(1000);
    expect(reports).toHaveLength(1);
  });

  it('adds the step of an operation made of several commands to what each command reports', () => {
    const { operations, reports } = tracker();
    const { context } = started((work) => operations.run('switch-1', work));

    context.beginStep('Shelving your changes', 1, 4);
    context.beginStep('Switching', 3, 4);
    context.progressOf(downloads)('downloading 1/9');

    expect(reports).toEqual([
      { stage: 'working', stageLabel: 'Shelving your changes', fraction: null, step: { label: 'Shelving your changes', index: 1, count: 4 } },
      { stage: 'working', stageLabel: 'Switching', fraction: null, step: { label: 'Switching', index: 3, count: 4 } },
      expect.objectContaining({ stageLabel: 'downloading', current: 1, step: { label: 'Switching', index: 3, count: 4 } }),
    ]);
  });

  it("reports what the app does in its own words, counted when it counts", () => {
    const { operations, reports } = tracker();
    const { context } = started((work) => operations.run('merge-1', work));

    context.reportProgress('Writing resolved files', { current: 1, total: 4 });
    context.reportProgress('Checking', { current: 0, total: 0 });
    expect(reports).toEqual<CommandProgress[]>([
      { stage: 'working', stageLabel: 'Writing resolved files', current: 1, total: 4, fraction: 0.25 },
      { stage: 'working', stageLabel: 'Checking', fraction: null },
    ]);
  });

  it('stops an operation the user cancels, and only that one', () => {
    const { operations } = tracker();
    const update = started((work) => operations.run('update-1', work));
    const checkin = started((work) => operations.run('checkin-2', work));

    operations.cancel('update-1');
    operations.cancel('unknown');
    expect(update.context.signal.aborted).toBe(true);
    expect(checkin.context.signal.aborted).toBe(false);
  });

  it('forgets an operation once it ends, however it ends', async () => {
    const { operations } = tracker();
    const failing = started((work) => operations.run('update-1', work));
    failing.fail(new Error('The server is unreachable.'));
    await expect(failing.result).rejects.toThrow('The server is unreachable.');

    operations.cancel('update-1');
    expect(failing.context.signal.aborted).toBe(false);
  });

  it('tells when a workspace write starts, so the watcher ignores what it changes; a slow read changes nothing', () => {
    const { operations, started: writes } = tracker();

    started((work) => operations.run('update-1', work));
    started((work) => operations.read('find-2', work));
    expect(writes).toHaveLength(1);
  });
});
