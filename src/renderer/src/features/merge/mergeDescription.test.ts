import { describe, expect, it } from 'vitest';
import type { MergePlan } from '@shared/domain/merge';
import { completionCounts, completionTitle, describeSpec, mergeLabels, mergeTitle, mergeTitleText } from './mergeDescription';

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
