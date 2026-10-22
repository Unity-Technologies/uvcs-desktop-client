import { describe, expect, it } from 'vitest';
import type { MergeTool } from '@shared/domain/mergeTools';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { allInLabel, leftOutNote, planRun, runLabel, runPlans, runStripWords, runSummary, runTip, runTool } from './resolveRun';

const tool = (id: string, changes: Partial<MergeTool> = {}): MergeTool => ({
  id,
  name: id,
  origin: 'known',
  executable: id,
  args: [],
  defaultArgs: [],
  canBringToFront: false,
  ...changes,
});
const fakeMerge = tool('FakeMerge');
const otherMerge = tool('OtherMerge');

const file = (path: string, changes: Partial<FileConflictState> = {}): FileConflictState => ({
  file: { key: `/${path}`, path, base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } },
  status: 'ready',
  isBinary: false,
  decidedByUser: false,
  resolution: null,
  mergedAutomatically: false,
  remainingConflicts: 1,
  ...changes,
});

const states = [
  file('a.ts'),
  file('decided.ts', { resolution: { choice: 'source' } }),
  file('b.ts'),
  file('logo.png', { isBinary: true }),
  file('loading.ts', { status: 'loading' }),
];

describe('planRun', () => {
  it('goes through the files waiting that the tool opens, in order, and leaves the others to the user', () => {
    const plan = planRun(states, () => fakeMerge);
    expect(plan.steps).toEqual([
      { key: '/a.ts', tool: fakeMerge },
      { key: '/b.ts', tool: fakeMerge },
    ]);
    expect(plan.left.map((state) => state.file.path)).toEqual(['logo.png']);
  });

  it('skips a file already open in a tool', () => {
    expect(planRun([file('a.ts', { openTool: { sessionId: 's', toolName: 'x', canBringToFront: false } }), file('b.ts')], () => fakeMerge).steps.map((step) => step.key)).toEqual(['/b.ts']);
  });
});

describe('planRun, by tool', () => {
  it('opens each file in its own tool, or every one in the tool picked for the run', () => {
    const toolFor = (state: FileConflictState) => (state.file.path === 'b.ts' ? otherMerge : fakeMerge);
    expect(planRun(states, toolFor).steps.map((step) => step.tool.id)).toEqual(['FakeMerge', 'OtherMerge']);
    expect(planRun(states, toolFor, otherMerge).steps.map((step) => step.tool.id)).toEqual(['OtherMerge', 'OtherMerge']);
  });

  it('leaves out a file no tool opens: none was found', () => {
    expect(planRun(states, () => undefined).steps).toEqual([]);
  });
});

describe('runTool', () => {
  it('is the tool every file opens in, picked or the same for each, and none when they differ', () => {
    expect(runTool(planRun(states, () => fakeMerge))!.id).toBe('FakeMerge');
    expect(runTool(planRun(states, (state) => (state.file.path === 'b.ts' ? otherMerge : fakeMerge)))).toBeNull();
    expect(runTool(planRun(states, () => fakeMerge, otherMerge))!.id).toBe('OtherMerge');
  });
});

describe('runPlans', () => {
  const byPath = (state: FileConflictState) => (state.file.path === 'b.ts' ? otherMerge : fakeMerge);

  it('offers each file in its own tool first, then every file in one tool, for each tool', () => {
    const plans = runPlans(states, [fakeMerge, otherMerge], byPath);
    expect(plans.map((plan) => plan.picked?.id ?? 'by file')).toEqual(['by file', 'FakeMerge', 'OtherMerge']);
  });

  it('offers no run in the one tool every file already opens in', () => {
    expect(runPlans(states, [fakeMerge, otherMerge], () => fakeMerge).map((plan) => plan.picked?.id ?? 'by file')).toEqual(['by file', 'OtherMerge']);
  });

  it('never runs a tool on binaries, which keep one of their versions', () => {
    const binaries = [file('a.png', { isBinary: true }), file('b.png', { isBinary: true })];
    expect(runPlans(binaries, [fakeMerge, otherMerge], () => fakeMerge)).toEqual([]);
  });
});

describe('leftOutNote', () => {
  it('says why files stay out of the run', () => {
    expect(leftOutNote(planRun(states, () => fakeMerge))).toBe('Binary files keep one version: logo.png is left to you');
    expect(leftOutNote(planRun([file('a.ts')], () => fakeMerge))).toBeUndefined();
    const binaries = ['a.png', 'b.png', 'c.png', 'd.png'].map((path) => file(path, { isBinary: true }));
    expect(leftOutNote(planRun([file('a.ts'), ...binaries], () => fakeMerge))).toBe('Binary files keep one version: a.png, b.png and 2 others are left to you');
  });
});

describe('runLabel', () => {
  it('counts the conflicts the run goes through, naming the tool when they all open in one', () => {
    expect(runLabel(planRun(states, () => fakeMerge))).toBe('Resolve 2 conflicts in FakeMerge');
    expect(runLabel(planRun(states, (state) => (state.file.path === 'b.ts' ? otherMerge : fakeMerge)))).toBe('Resolve 2 conflicts one by one');
  });
});

describe('runTip', () => {
  it('says where the files open and how to go on', () => {
    expect(runTip(planRun(states, () => fakeMerge))).toBe('Opens each file in FakeMerge in turn: save and close it there to get the next');
    expect(runTip(planRun(states, (state) => (state.file.path === 'b.ts' ? otherMerge : fakeMerge)))).toBe('Opens each file in its merge tool in turn: save and close it there to get the next');
  });
});

describe('allInLabel', () => {
  it('names the tool picked for the run, with how many files it opens', () => {
    expect(allInLabel(planRun(states, () => fakeMerge, otherMerge))).toBe('All in OtherMerge · 2 conflicts');
  });
});

describe('runSummary', () => {
  const plan = planRun(states, () => fakeMerge);

  it('celebrates when every file was resolved, still naming what was left out', () => {
    expect(runSummary({ resolved: 2, total: 2, stopped: false, withSmartMerge: 0 }, plan)).toEqual({
      kind: 'success',
      title: 'Resolved both conflicts in FakeMerge',
      detail: 'Binary files keep one version: logo.png is left to you.',
    });
    expect(runSummary({ resolved: 5, total: 5, stopped: false, withSmartMerge: 0 }, planRun([file('a.ts')], () => tool('UVCS merge tool')))).toEqual({ kind: 'success', title: 'Resolved all 5 conflicts in UVCS merge tool' });
  });

  it('counts what still needs the user, and says when they stopped', () => {
    expect(runSummary({ resolved: 4, total: 5, stopped: false, withSmartMerge: 0 }, planRun([file('a.ts')], () => tool('UVCS merge tool')))).toEqual({
      kind: 'info',
      title: 'Resolved 4 of 5 in UVCS merge tool',
      detail: '1 still needs you.',
    });
    expect(runSummary({ resolved: 1, total: 3, stopped: true, withSmartMerge: 0 }, planRun([file('a.ts')], () => tool('UVCS merge tool'))).title).toBe('Stopped: resolved 1 of 3 in UVCS merge tool');
  });

  it('tells what Smart Merge merged apart from what the tool resolved', () => {
    const three = planRun([file('a.prefab'), file('b.prefab'), file('c.ts')], () => tool('VS Code'));
    expect(runSummary({ resolved: 3, total: 3, stopped: false, withSmartMerge: 2 }, three).title).toBe('Resolved all 3 conflicts: 2 with Smart Merge, 1 in VS Code');
    expect(runSummary({ resolved: 3, total: 3, stopped: false, withSmartMerge: 3 }, three).title).toBe('Resolved all 3 conflicts with Smart Merge');
    expect(runSummary({ resolved: 3, total: 5, stopped: false, withSmartMerge: 2 }, three).title).toBe('Resolved 3 of 5: 2 with Smart Merge, 1 in VS Code');
    expect(runSummary({ resolved: 1, total: 2, stopped: true, withSmartMerge: 1 }, three).title).toBe('Stopped: resolved 1 of 2 with Smart Merge');
  });

  it('names no tool when the files open in different ones', () => {
    const mixed = planRun([file('a.ts'), file('b.ts')], (state) => (state.file.path === 'b.ts' ? otherMerge : fakeMerge));
    expect(runSummary({ resolved: 2, total: 2, stopped: false, withSmartMerge: 0 }, mixed).title).toBe('Resolved both conflicts');
    expect(runSummary({ resolved: 2, total: 3, stopped: false, withSmartMerge: 1 }, mixed).title).toBe('Resolved 2 of 3: 1 with Smart Merge, 1 in merge tools');
    expect(runSummary({ resolved: 0, total: 2, stopped: true, withSmartMerge: 0 }, mixed).title).toBe('Stopped resolving one by one');
  });

  it('says only that it stopped when nothing was resolved yet', () => {
    expect(runSummary({ resolved: 0, total: 12, stopped: true, withSmartMerge: 0 }, planRun([file('a.ts')], () => tool('UVCS merge tool')))).toEqual({
      kind: 'info',
      title: 'Stopped resolving in UVCS merge tool',
      detail: '12 still need you.',
    });
  });
});

describe('runStripWords', () => {
  it('speaks of the tool while it has the file: skipping or stopping closes it, keeping what was saved, and Esc asks first', () => {
    expect(runStripWords('VS Code', false)).toEqual({
      where: 'in VS Code',
      skipTip: 'Closes it in VS Code and opens the next file',
      stopTip: 'Closes it in VS Code; what you saved there so far is kept',
      confirmsStop: true,
    });
  });

  it('speaks of Smart Merge while it merges: there is no window to close nor anything saved, so Esc stops at once', () => {
    expect(runStripWords('VS Code', true)).toEqual({
      where: 'with Smart Merge',
      skipTip: 'Stops Smart Merge and goes on to the next file',
      stopTip: 'Stops Smart Merge; the file stays as it was',
      confirmsStop: false,
    });
  });
});
