import { describe, expect, it } from 'vitest';
import type { MergeTool } from '@shared/domain/mergeTools';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { leftOutNote, planRun, runLabel, runPlans, runSummary } from './resolveRun';

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
    const plan = planRun(states, fakeMerge);
    expect(plan.keys).toEqual(['/a.ts', '/b.ts']);
    expect(plan.left.map((state) => state.file.path)).toEqual(['logo.png']);
  });

  it('skips a file already open in a tool', () => {
    expect(planRun([file('a.ts', { openTool: { sessionId: 's', toolName: 'x', canBringToFront: false } }), file('b.ts')], fakeMerge).keys).toEqual(['/b.ts']);
  });
});

describe('runPlans', () => {
  it('offers the preferred tool first, then the others', () => {
    expect(runPlans(states, [otherMerge, fakeMerge], 'FakeMerge').map((plan) => plan.tool.id)).toEqual(['FakeMerge', 'OtherMerge']);
  });

  it('starts with the first tool when the preferred one is gone', () => {
    expect(runPlans(states, [otherMerge, fakeMerge], 'gone').map((plan) => plan.tool.id)).toEqual(['OtherMerge', 'FakeMerge']);
  });

  it('never runs a tool on binaries, which keep one of their versions', () => {
    const binaries = [file('a.png', { isBinary: true }), file('b.png', { isBinary: true })];
    expect(runPlans(binaries, [fakeMerge, otherMerge], 'FakeMerge')).toEqual([]);
  });
});

describe('leftOutNote', () => {
  it('says why files stay out of the run', () => {
    expect(leftOutNote(planRun(states, fakeMerge))).toBe('Binary files keep one version: logo.png is left to you');
    expect(leftOutNote(planRun([file('a.ts')], fakeMerge))).toBeUndefined();
    const binaries = ['a.png', 'b.png', 'c.png', 'd.png'].map((path) => file(path, { isBinary: true }));
    expect(leftOutNote(planRun([file('a.ts'), ...binaries], fakeMerge))).toBe('Binary files keep one version: a.png, b.png and 2 others are left to you');
  });
});

describe('runLabel', () => {
  it('counts the conflicts the run goes through', () => {
    expect(runLabel(planRun(states, fakeMerge))).toBe('Resolve 2 conflicts in FakeMerge');
  });
});

describe('runSummary', () => {
  const plan = planRun(states, fakeMerge);

  it('celebrates when every file was resolved, still naming what was left out', () => {
    expect(runSummary({ resolved: 2, total: 2, stopped: false }, plan)).toEqual({
      kind: 'success',
      title: 'Resolved both conflicts in FakeMerge',
      detail: 'Binary files keep one version: logo.png is left to you.',
    });
    expect(runSummary({ resolved: 5, total: 5, stopped: false }, planRun([file('a.ts')], tool('UVCS merge tool')))).toEqual({ kind: 'success', title: 'Resolved all 5 conflicts in UVCS merge tool' });
  });

  it('counts what still needs the user, and says when they stopped', () => {
    expect(runSummary({ resolved: 4, total: 5, stopped: false }, planRun([file('a.ts')], tool('UVCS merge tool')))).toEqual({
      kind: 'info',
      title: 'Resolved 4 of 5 in UVCS merge tool',
      detail: '1 still needs you.',
    });
    expect(runSummary({ resolved: 1, total: 3, stopped: true }, planRun([file('a.ts')], tool('UVCS merge tool'))).title).toBe('Stopped: resolved 1 of 3 in UVCS merge tool');
  });

  it('says only that it stopped when nothing was resolved yet', () => {
    expect(runSummary({ resolved: 0, total: 12, stopped: true }, planRun([file('a.ts')], tool('UVCS merge tool')))).toEqual({
      kind: 'info',
      title: 'Stopped resolving in UVCS merge tool',
      detail: '12 still need you.',
    });
  });
});
