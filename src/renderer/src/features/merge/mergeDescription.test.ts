import { describe, expect, it } from 'vitest';
import type { MergePlan } from '@shared/domain/merge';
import { completionCounts, completionTitle, describeSpec, mergeInProgressWords, mergeLabels, replaceMergeQuestion, mergeTitle, mergeTitleText } from './mergeDescription';

const plan: MergePlan = {
  status: 'ready',
  contributors: { source: { changesetId: 3, branch: '/main/task' }, destination: { changesetId: 4, branch: '/main' } },
  changes: [],
  fileConflicts: [],
  directoryConflicts: [],
  warnings: [],
};

describe('describeSpec', () => {
  it('reads specs the way people say them', () => {
    expect(describeSpec('br:/main/task')).toBe('/main/task');
    expect(describeSpec('cs:12')).toBe('changeset 12');
    expect(describeSpec('lb:v1.0')).toBe('label v1.0');
    expect(describeSpec('sh:3')).toBe('shelve 3');
  });
});

describe('mergeLabels', () => {
  it('names each side by its branch', () => {
    expect(mergeLabels({ kind: 'cherryPick', sourceSpec: 'cs:3' }, plan)).toMatchObject({ source: '/main/task', destination: '/main' });
  });

  it('calls the workspace side yours, and neither side when merging on the server', () => {
    const intoWorkspace = mergeLabels({ kind: 'merge', sourceSpec: 'br:/main/task' }, plan);
    expect([intoWorkspace.roles.destination.name, intoWorkspace.roles.source.name]).toEqual(['Yours', 'Incoming']);
    const intoBranch = mergeLabels({ kind: 'merge', sourceSpec: 'br:/main', destinationBranch: '/main/release' }, plan);
    expect([intoBranch.roles.destination.name, intoBranch.roles.source.name]).toEqual(['Destination', 'Source']);
  });

  it('uses the server branch for merges into a branch', () => {
    expect(mergeLabels({ kind: 'merge', sourceSpec: 'br:/main', destinationBranch: '/main/release' }, plan).destination).toBe('/main/release');
  });
});

describe('mergeTitle', () => {
  it('keeps the names apart from the words around them', () => {
    expect(mergeTitle({ kind: 'merge', sourceSpec: 'br:/main/task' }, '/main')).toEqual({ verb: 'Merge', source: '/main/task', preposition: 'into', destination: '/main' });
  });

  it('describes each kind of merge', () => {
    const title = (...args: Parameters<typeof mergeTitle>): string => mergeTitleText(mergeTitle(...args));
    expect(title({ kind: 'merge', sourceSpec: 'br:/main/task' }, '/main')).toBe('Merge /main/task into /main');
    expect(title({ kind: 'merge', sourceSpec: 'sh:2' }, '/main')).toBe('Apply shelve 2 to /main');
    expect(title({ kind: 'cherryPick', sourceSpec: 'cs:9', intervalOriginSpec: 'cs:5' }, '/main')).toBe('Cherry pick changeset 5…changeset 9 into /main');
    expect(title({ kind: 'subtractive', sourceSpec: 'cs:7' }, '/main')).toBe('Undo changeset 7 on /main');
  });
});

describe('mergeInProgressWords', () => {
  it('names what the merge does to what, and where it goes in full', () => {
    expect(mergeInProgressWords({ kind: 'merge', sourceSpec: 'br:/main/task' }, false)).toEqual({
      label: 'Merge /main/task',
      railLabel: 'Merge',
      tip: 'In progress: Merge /main/task into your workspace',
    });
    expect(mergeInProgressWords({ kind: 'merge', sourceSpec: 'br:/main/task', destinationBranch: '/main' }, false).tip).toBe('In progress: Merge /main/task into /main');
    expect(mergeInProgressWords({ kind: 'subtractive', sourceSpec: 'cs:7' }, false)).toMatchObject({ label: 'Undo changeset 7', railLabel: 'Undo' });
  });

  it("doesn't call a settled merge in progress", () => {
    expect(mergeInProgressWords({ kind: 'merge', sourceSpec: 'br:/main/task' }, true).tip).toBe('Merge /main/task into your workspace');
  });
});

describe('replaceMergeQuestion', () => {
  it('names the merge whose decisions would be discarded', () => {
    expect(replaceMergeQuestion({ kind: 'cherryPick', sourceSpec: 'cs:9' }).message).toBe("Cherry pick changeset 9 into your workspace isn't complete. Starting another merge discards what you decided in it.");
  });
});

describe('completionTitle', () => {
  it('states what the merge did once it ran, in its own words', () => {
    expect(completionTitle({ kind: 'merge', sourceSpec: 'br:/main/task' })).toBe('Merge complete');
    expect(completionTitle({ kind: 'merge', sourceSpec: 'sh:2' })).toBe('Shelve applied');
    expect(completionTitle({ kind: 'cherryPick', sourceSpec: 'cs:9' })).toBe('Cherry pick complete');
    expect(completionTitle({ kind: 'subtractive', sourceSpec: 'cs:7' })).toBe('Changes undone');
  });
});

describe('completionCounts', () => {
  it('counts what the merge did, leaving out what it did none of', () => {
    expect(completionCounts(3, 2)).toBe('3 changes applied · 2 conflicts resolved');
    expect(completionCounts(0, 17)).toBe('17 conflicts resolved');
    expect(completionCounts(1, 0)).toBe('1 change applied');
    expect(completionCounts(0, 0)).toBe('');
  });
});
