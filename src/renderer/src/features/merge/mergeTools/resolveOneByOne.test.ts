import { describe, expect, it } from 'vitest';
import type { MergeTool, MergeToolOutcome } from '@shared/domain/mergeTools';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { waitsForTool } from './mergeToolOutcome';
import { resolveOneByOne, runEndMessage, stopRun, type RunControl, type RunEnd } from './resolveOneByOne';
import { planRun, type RunPlan } from './resolveRun';

const fakeMerge: MergeTool = { id: 'FakeMerge', name: 'FakeMerge', origin: 'known', executable: 'fakemerge', args: [], defaultArgs: [], extensions: null, canBringToFront: false };

const saved: MergeToolOutcome = { kind: 'resolved', text: 'merged\n' };
const closedUnsaved: MergeToolOutcome = { kind: 'unchanged', exitCode: 0, errorOutput: '' };
/** Skip this file, or Stop: the app stops waiting for the tool. */
const stoppedWaiting: MergeToolOutcome = { kind: 'unchanged', exitCode: null, errorOutput: '' };
const cantStart: MergeToolOutcome = { kind: 'failed', message: 'spawn fakemerge ENOENT' };

const conflict = (path: string): FileConflictState => ({
  file: { key: `/${path}`, path, base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } },
  status: 'ready',
  isBinary: false,
  decidedByUser: false,
  resolution: null,
  mergedAutomatically: false,
  remainingConflicts: 1,
});

/** What the user does in the tool with a file, given the run (to stop it, or decide other files meanwhile). */
type InTool = (page: FakePage) => MergeToolOutcome | null;
/** What the user answers when the run pauses on a file closed unsaved. */
type AtPause = (page: FakePage) => void;

/**
 * The merge page around a run, as `useResolveRun` wires it: the files' states (a file saved in the tool is decided),
 * what the run showed and opened, and the user's part scripted per file.
 */
class FakePage {
  states: FileConflictState[];
  readonly run: RunControl = { stopped: false };
  readonly events: string[] = [];
  readonly positions: string[] = [];

  constructor(
    paths: string[],
    private readonly inTool: Record<string, InTool>,
    private readonly options: { asks?: boolean; atPause?: AtPause } = {},
  ) {
    this.states = paths.map(conflict);
  }

  get plan(): RunPlan {
    return planRun(this.states, fakeMerge);
  }

  decide(path: string): void {
    this.states = this.states.map((state) => (state.file.path === path ? { ...state, resolution: { choice: 'source' }, decidedByUser: true } : state));
  }

  async runOneByOne(): Promise<{ end: RunEnd; message: ReturnType<typeof runEndMessage> }> {
    const plan = this.plan;
    const end = await resolveOneByOne(plan, this.run, {
      stillWaits: (key) => this.states.some((state) => state.file.key === key && waitsForTool(state, fakeMerge)),
      show: (progress) => {
        this.positions.push(`${progress.position + 1} of ${progress.total}`);
        if (!progress.paused) return;
        this.events.push(`paused on ${progress.currentKey}`);
        // The run waits for the answer right after showing the pause.
        queueMicrotask(() => (this.options.atPause ?? ((page) => page.run.answer!(true)))(this));
      },
      open: (key, previousKey) => this.events.push(previousKey ? `open ${key} after ${previousKey}` : `open ${key}`),
      resolve: async (key) => {
        const outcome = (this.inTool[key.slice(1)] ?? (() => saved))(this);
        if (outcome?.kind === 'resolved') this.decide(key.slice(1));
        return outcome;
      },
      asksWhenClosedUnsaved: () => this.options.asks ?? true,
    });
    return { end, message: runEndMessage(plan, end, this.states) };
  }
}

describe('resolving one by one', () => {
  it('opens each file once the one before is closed, in the list order, with the selection following it', async () => {
    const page = new FakePage(['a.ts', 'b.ts', 'c.ts'], {});
    const { end, message } = await page.runOneByOne();
    expect(page.events).toEqual(['open /a.ts', 'open /b.ts after /a.ts', 'open /c.ts after /b.ts']);
    expect(page.positions).toEqual(['1 of 3', '2 of 3', '3 of 3']);
    expect(end).toEqual({ stopped: false });
    expect(message).toEqual({ kind: 'success', title: 'Resolved all 3 conflicts in FakeMerge' });
  });

  it('skips the files decided in the app meanwhile, keeping their place in the count', async () => {
    const page = new FakePage(['a.ts', 'b.ts', 'c.ts'], {
      'a.ts': (page) => {
        page.decide('b.ts');
        return saved;
      },
    });
    await page.runOneByOne();
    expect(page.events).toEqual(['open /a.ts', 'open /c.ts after /a.ts']);
    expect(page.positions).toEqual(['1 of 3', '3 of 3']);
  });

  it('goes on to the next file when one is skipped, without asking', async () => {
    const page = new FakePage(['a.ts', 'b.ts'], { 'a.ts': () => stoppedWaiting });
    const { message } = await page.runOneByOne();
    expect(page.events).toEqual(['open /a.ts', 'open /b.ts after /a.ts']);
    expect(message).toEqual({ kind: 'info', title: 'Resolved 1 of 2 in FakeMerge', detail: '1 still needs you.' });
  });

  it('pauses on a file closed without saving, and goes on to the next when told', async () => {
    const page = new FakePage(['a.ts', 'b.ts'], { 'a.ts': () => closedUnsaved });
    await page.runOneByOne();
    expect(page.events).toEqual(['open /a.ts', 'paused on /a.ts', 'open /b.ts after /a.ts']);
    expect(page.states.map((state) => state.resolution)).toEqual([null, { choice: 'source' }]);
  });

  it('ends at the pause when the user stops there', async () => {
    const page = new FakePage(['a.ts', 'b.ts'], { 'a.ts': () => closedUnsaved }, { atPause: (page) => stopRun(page.run) });
    const { end, message } = await page.runOneByOne();
    expect(page.events).toEqual(['open /a.ts', 'paused on /a.ts']);
    expect(end.stopped).toBe(true);
    expect(message).toEqual({ kind: 'info', title: 'Stopped resolving in FakeMerge', detail: '2 still need you.' });
  });

  it('goes on after a file closed without saving when the setting says not to ask', async () => {
    const page = new FakePage(['a.ts', 'b.ts'], { 'a.ts': () => closedUnsaved }, { asks: false });
    await page.runOneByOne();
    expect(page.events).toEqual(['open /a.ts', 'open /b.ts after /a.ts']);
  });

  it('never pauses when no file after it still waits', async () => {
    const lastClosed = new FakePage(['a.ts', 'b.ts'], { 'b.ts': () => closedUnsaved });
    await lastClosed.runOneByOne();
    expect(lastClosed.events).toEqual(['open /a.ts', 'open /b.ts after /a.ts']);

    const restDecided = new FakePage(['a.ts', 'b.ts'], {
      'a.ts': (page) => {
        page.decide('b.ts');
        return closedUnsaved;
      },
    });
    await restDecided.runOneByOne();
    expect(restDecided.events).toEqual(['open /a.ts']);
  });

  it('stops at a tool that can not start, saying why, and opens nothing more', async () => {
    const page = new FakePage(['a.ts', 'b.ts'], { 'a.ts': () => cantStart });
    const { end, message } = await page.runOneByOne();
    expect(page.events).toEqual(['open /a.ts']);
    expect(end).toEqual({ stopped: false, failure: { outcome: cantStart, key: '/a.ts' } });
    expect(message).toEqual({ kind: 'error', title: "Couldn't open a.ts in FakeMerge", detail: 'spawn fakemerge ENOENT. Stopped resolving one by one.' });
  });

  it('ends with the file open when the user stops, counting what was saved before', async () => {
    const page = new FakePage(['a.ts', 'b.ts', 'c.ts'], {
      'b.ts': (page) => {
        stopRun(page.run);
        return stoppedWaiting;
      },
    });
    const { end, message } = await page.runOneByOne();
    expect(page.events).toEqual(['open /a.ts', 'open /b.ts after /a.ts']);
    expect(end.stopped).toBe(true);
    expect(message).toEqual({ kind: 'info', title: 'Stopped: resolved 1 of 3 in FakeMerge', detail: '2 still need you.' });
  });

  it('ends when a file can no longer be opened, as when the page went away', async () => {
    const page = new FakePage(['a.ts', 'b.ts'], { 'a.ts': () => null });
    await page.runOneByOne();
    expect(page.events).toEqual(['open /a.ts']);
  });
});

describe('runEndMessage', () => {
  it('keeps the sentence a tool already ended', () => {
    const plan = planRun([conflict('a.ts')], fakeMerge);
    const failure = { outcome: { kind: 'failed', message: 'Not found!' } as MergeToolOutcome, key: '/a.ts' };
    expect(runEndMessage(plan, { stopped: false, failure }, []).detail).toBe('Not found! Stopped resolving one by one.');
  });
});
