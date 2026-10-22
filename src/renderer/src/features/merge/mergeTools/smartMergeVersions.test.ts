import { describe, expect, it } from 'vitest';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { isUnityAsset, smartMergeVersions } from './smartMergeVersions';

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
  it('hands UnityYAMLMerge the three versions of a Unity asset, whatever its extension', () => {
    const material = conflict('Assets/Red.mat', { base: `${UNITY}b`, source: `${UNITY}s`, destination: `${UNITY}d` });
    expect(smartMergeVersions(material, true)).toEqual({ path: 'Assets/Red.mat', base: `${UNITY}b`, yours: `${UNITY}d`, incoming: `${UNITY}s` });
  });

  it('gives an empty base when the base revision was an empty file', () => {
    expect(smartMergeVersions(conflict('Assets/New.prefab', { source: `${UNITY}s`, destination: `${UNITY}d` }), true)?.base).toBe('');
  });

  it('leaves to the tool a file the user decided something for, and anything that isn’t a Unity asset on both sides', () => {
    const prefab = { base: `${UNITY}b`, source: `${UNITY}s`, destination: `${UNITY}d` };
    expect(smartMergeVersions(conflict('Assets/P.prefab', prefab, { decidedByUser: true }), true)).toBeNull();
    expect(smartMergeVersions(conflict('Assets/P.prefab', prefab, { isBinary: true }), true)).toBeNull();
    expect(smartMergeVersions(conflict('Assets/P.prefab', { ...prefab, source: 'fileFormatVersion: 2\n' }), true)).toBeNull();
    expect(smartMergeVersions(conflict('Assets/P.prefab', prefab, { contents: undefined }), true)).toBeNull();
  });
});

describe('isUnityAsset', () => {
  const prefab = { base: `${UNITY}b`, source: `${UNITY}s`, destination: `${UNITY}d` };

  it('is a Unity asset on both sides, whatever its extension, even once the user decided something for it', () => {
    expect(isUnityAsset(conflict('Assets/Red.mat', prefab), true)).toBe(true);
    expect(isUnityAsset(conflict('Assets/P.prefab', prefab, { decidedByUser: true }), true)).toBe(true);
  });

  it('is not one with a side that isn’t, nor a binary, nor before its versions are read', () => {
    expect(isUnityAsset(conflict('Assets/P.prefab', { ...prefab, destination: 'plain' }), true)).toBe(false);
    expect(isUnityAsset(conflict('Assets/P.prefab', prefab, { isBinary: true }), true)).toBe(false);
    expect(isUnityAsset(conflict('Assets/P.prefab', prefab, { contents: undefined }), true)).toBe(false);
  });
});

describe('a .meta file', () => {
  const meta = { base: 'fileFormatVersion: 2\nguid: 1\n', source: 'fileFormatVersion: 2\nguid: 2\n', destination: 'fileFormatVersion: 2\nguid: 3\n' };

  it('goes to UnityYAMLMerge by its name, with no Unity header, in any case where the OS ignores it', () => {
    expect(smartMergeVersions(conflict('Assets/Tex.png.meta', meta), true)).toEqual({ path: 'Assets/Tex.png.meta', base: meta.base, yours: meta.destination, incoming: meta.source });
    expect(isUnityAsset(conflict('Assets/Tex.png.META', meta), true)).toBe(true);
    expect(isUnityAsset(conflict('Assets/Tex.png.META', meta), false)).toBe(false);
  });

  it('is the only plain text that does: another file of plain text, or a binary .meta, doesn’t', () => {
    expect(isUnityAsset(conflict('Assets/notes.txt', meta), true)).toBe(false);
    expect(isUnityAsset(conflict('Assets/Tex.png.meta', meta, { isBinary: true }), true)).toBe(false);
  });
});
