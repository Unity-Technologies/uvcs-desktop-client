import { describe, expect, it } from 'vitest';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { smartMergeVersions } from './smartMergeVersions';

const UNITY = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n';
const text = (value: string) => ({ text: value, isBinary: false, size: value.length });

const conflict = (path: string, versions: { base?: string; source: string; destination: string }, changes: Partial<FileConflictState> = {}): FileConflictState => ({
  file: { key: `/${path}`, path, base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } },
  status: 'ready',
  isBinary: false,
  decidedByUser: false,
  contents: { base: versions.base === undefined ? { isBinary: false, size: 0 } : text(versions.base), source: text(versions.source), destination: text(versions.destination) },
  resolution: null,
  mergedAutomatically: false,
  remainingConflicts: 1,
  ...changes,
});

describe('smartMergeVersions', () => {
  it('hands Smart Merge the three versions of a Unity asset, whatever its extension', () => {
    const material = conflict('Assets/Red.mat', { base: `${UNITY}b`, source: `${UNITY}s`, destination: `${UNITY}d` });
    expect(smartMergeVersions(material)).toEqual({ path: 'Assets/Red.mat', base: `${UNITY}b`, yours: `${UNITY}d`, incoming: `${UNITY}s` });
  });

  it('gives an empty base for a file added on both sides', () => {
    expect(smartMergeVersions(conflict('Assets/New.prefab', { source: `${UNITY}s`, destination: `${UNITY}d` }))?.base).toBe('');
  });

  it('leaves to the tool a file the user decided something for, and anything that isn’t a Unity asset on both sides', () => {
    const prefab = { base: `${UNITY}b`, source: `${UNITY}s`, destination: `${UNITY}d` };
    expect(smartMergeVersions(conflict('Assets/P.prefab', prefab, { decidedByUser: true }))).toBeNull();
    expect(smartMergeVersions(conflict('Assets/P.prefab', prefab, { isBinary: true }))).toBeNull();
    expect(smartMergeVersions(conflict('Assets/P.prefab', { ...prefab, source: 'fileFormatVersion: 2\n' }))).toBeNull();
    expect(smartMergeVersions(conflict('Assets/Tex.png.meta', { base: 'guid: 1', source: 'guid: 2', destination: 'guid: 3' }))).toBeNull();
    expect(smartMergeVersions(conflict('Assets/P.prefab', prefab, { contents: undefined }))).toBeNull();
  });
});
