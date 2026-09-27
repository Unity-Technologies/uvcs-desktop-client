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
  extensions: null,
  canBringToFront: false,
  ...changes,
});
const fakeMerge = tool('FakeMerge');
const csMerge = tool('CsMerge', { extensions: ['.cs'] });

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
  it('offers the preferred tool first, then the others that open something', () => {
    const withCs = [...states, file('c.cs')];
    expect(runPlans(withCs, [csMerge, fakeMerge], 'FakeMerge').map((plan) => plan.tool.id)).toEqual(['FakeMerge', 'CsMerge']);
  });

  it('falls back to the tool that opens the most when the preferred one opens nothing', () => {
    expect(runPlans([file('a.cs'), file('b.cs')], [csMerge, fakeMerge], 'CsMerge').map((plan) => plan.tool.id)).toEqual(['CsMerge', 'FakeMerge']);
    expect(runPlans([file('a.ts')], [csMerge, fakeMerge], 'CsMerge').map((plan) => plan.tool.id)).toEqual(['FakeMerge']);
  });

  it('never runs a tool on binaries, which keep one of their versions', () => {
    const binaries = [file('a.png', { isBinary: true }), file('b.png', { isBinary: true })];
    expect(runPlans(binaries, [fakeMerge, csMerge], 'FakeMerge')).toEqual([]);
  });
});

describe('leftOutNote', () => {
  it('says why files stay out of the run', () => {
    expect(leftOutNote(planRun(states, fakeMerge))).toBe('Binary files keep one version: logo.png is left to you');
    expect(leftOutNote(planRun([file('a.ts')], fakeMerge))).toBeUndefined();
    expect(leftOutNote(planRun([file('a.cs'), file('b.ts'), file('c.ts'), file('d.ts')], csMerge))).toBe(
      "CsMerge doesn't open these files: b.ts, c.ts and 1 other are left to you",
    );
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
