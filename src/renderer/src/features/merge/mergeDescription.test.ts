import { describe, expect, it } from 'vitest';
import type { MergePlan } from '@shared/domain/merge';
import { describeSpec, mergeLabels, mergeTitle } from './mergeDescription';

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
    expect(mergeLabels({ kind: 'cherryPick', sourceSpec: 'cs:3' }, plan)).toEqual({ source: '/main/task', destination: '/main' });
  });

  it('uses the server branch for merges into a branch', () => {
    expect(mergeLabels({ kind: 'merge', sourceSpec: 'br:/main', destinationBranch: '/main/release' }, plan).destination).toBe('/main/release');
  });
});

describe('mergeTitle', () => {
  it('describes each kind of merge', () => {
    expect(mergeTitle({ kind: 'merge', sourceSpec: 'br:/main/task' }, '/main')).toBe('Merge /main/task into /main');
    expect(mergeTitle({ kind: 'merge', sourceSpec: 'sh:2' }, '/main')).toBe('Apply shelve 2 to /main');
    expect(mergeTitle({ kind: 'cherryPick', sourceSpec: 'cs:9', intervalOriginSpec: 'cs:5' }, '/main')).toBe('Cherry pick changeset 5…changeset 9 into /main');
    expect(mergeTitle({ kind: 'subtractive', sourceSpec: 'cs:7' }, '/main')).toBe('Undo changeset 7 on /main');
  });
});
