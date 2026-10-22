import { describe, expect, it } from 'vitest';
import type { MergeTool, UnityYamlMergeTool } from '@shared/domain/mergeTools';
import { mergerName, mergeToolFor, otherMergers, sameMerger, type Merger, type MergeToolSetup } from './mergeToolFor';

const tool = (id: string): MergeTool => ({ id, name: id, origin: 'known', executable: id, args: [], defaultArgs: [], canBringToFront: false });
const editor = (editorVersion: string): UnityYamlMergeTool => ({ id: `unityyamlmerge:${editorVersion}`, executable: `/Unity/${editorVersion}/UnityYAMLMerge`, editorVersion });
const newest = editor('6000.3.19f1');
const older = editor('2022.3.10f1');

const setup: MergeToolSetup = {
  tools: [tool('uvcs'), tool('semantic'), tool('rider'), tool('kdiff3')],
  preferredId: 'uvcs',
  rules: [
    { id: 'unity', patterns: ['.prefab', '.unity'], toolId: 'unityyamlmerge', fallbackToolId: 'auto' },
    { id: 'shaders', patterns: ['.shader', '.hlsl'], toolId: 'rider' },
    { id: 'code', patterns: ['.cs', '.vb', '.java'], toolId: 'semantic' },
    { id: 'all-code', patterns: ['.cs'], toolId: 'kdiff3' },
  ],
  unityYamlMerges: [newest, older],
  ignoreCase: true,
};

/** What opens the file, as "tool" or "UnityYAMLMerge <editor> → fallback". */
const reading = (merger: Merger | undefined): string | undefined => {
  if (!merger) return undefined;
  return merger.kind === 'tool' ? merger.tool.id : `UnityYAMLMerge ${merger.merge.editorVersion} → ${merger.fallback?.id}`;
};
const openerOf = (path: string, changes: Partial<MergeToolSetup> = {}, unityYamlMergeable = true): string | undefined =>
  reading(mergeToolFor({ path, unityYamlMergeable }, { ...setup, ...changes }));

describe('mergeToolFor', () => {
  it('opens a file in the first rule that matches it, else in every other file’s tool', () => {
    expect(openerOf('Assets/Shaders/Water.hlsl')).toBe('rider');
    expect(openerOf('Assets/Scripts/Player.cs')).toBe('semantic');
    expect(openerOf('README.md')).toBe('uvcs');
  });

  it('passes by a rule whose tool isn’t found here', () => {
    expect(openerOf('Assets/Scripts/Player.cs', { tools: [tool('uvcs'), tool('kdiff3')] })).toBe('kdiff3');
    expect(openerOf('Assets/Shaders/Water.hlsl', { tools: [tool('uvcs')] })).toBe('uvcs');
  });

  it('matches names in any case where the OS does, and exactly where it doesn’t', () => {
    expect(openerOf('Player.CS')).toBe('semantic');
    expect(openerOf('Player.CS', { ignoreCase: false })).toBe('uvcs');
  });

  it('merges a Unity asset with the newest editor’s UnityYAMLMerge, Automatic falling back to every other file’s tool', () => {
    expect(openerOf('Assets/Hero.prefab')).toBe('UnityYAMLMerge 6000.3.19f1 → uvcs');
  });

  it('runs the editor a rule names, with the fallback it picked, and Automatic’s when that one is gone', () => {
    const pinned = (fallbackToolId: string) => ({ rules: [{ id: 'u', patterns: ['.prefab'], toolId: 'unityyamlmerge:2022.3.10f1', fallbackToolId }] });
    expect(openerOf('Hero.prefab', pinned('kdiff3'))).toBe('UnityYAMLMerge 2022.3.10f1 → kdiff3');
    expect(openerOf('Hero.prefab', pinned('gone'))).toBe('UnityYAMLMerge 2022.3.10f1 → uvcs');
  });

  it('passes by a rule of UnityYAMLMerge from an editor no longer installed, or without any', () => {
    expect(openerOf('Hero.prefab', { rules: [{ id: 'u', patterns: ['.prefab'], toolId: 'unityyamlmerge:2019.4.0f1' }] })).toBe('uvcs');
    expect(openerOf('Hero.prefab', { unityYamlMerges: [] })).toBe('uvcs');
  });

  it('opens the fallback straight away on a file UnityYAMLMerge wouldn’t run on (not Unity YAML, or decided already)', () => {
    expect(openerOf('Assets/Hero.prefab', {}, false)).toBe('uvcs');
    expect(openerOf('Hero.prefab', { rules: [{ id: 'u', patterns: ['.prefab'], toolId: 'unityyamlmerge', fallbackToolId: 'rider' }] }, false)).toBe('rider');
  });

  it('falls back to the first tool when every other file’s is gone, and to none without tools', () => {
    expect(openerOf('README.md', { preferredId: null, tools: [tool('kdiff3')] })).toBe('kdiff3');
    expect(openerOf('README.md', { preferredId: null, tools: [] })).toBeUndefined();
  });
});

describe('otherMergers', () => {
  const others = (path: string, unityYamlMergeable: boolean) => {
    const file = { path, unityYamlMergeable };
    return otherMergers(file, mergeToolFor(file, setup), setup).map(reading);
  };

  it('offers every tool but the file’s own', () => {
    expect(others('Assets/Water.hlsl', false)).toEqual(['uvcs', 'semantic', 'kdiff3']);
  });

  it('offers UnityYAMLMerge on Unity YAML only, falling back to the tool the file opens in', () => {
    expect(others('Assets/Weird.txt', true)).toEqual(['semantic', 'rider', 'kdiff3', 'UnityYAMLMerge 6000.3.19f1 → uvcs']);
    expect(others('Assets/Weird.txt', false)).not.toContain('UnityYAMLMerge 6000.3.19f1 → uvcs');
  });

  it('offers every tool and no second UnityYAMLMerge on a file UnityYAMLMerge merges already', () => {
    expect(others('Assets/Hero.prefab', true)).toEqual(['uvcs', 'semantic', 'rider', 'kdiff3']);
  });
});

describe('mergerName and sameMerger', () => {
  it('names a tool by its name and UnityYAMLMerge as Unity does', () => {
    expect(mergerName({ kind: 'tool', tool: tool('Meld') })).toBe('Meld');
    expect(mergerName({ kind: 'unityYamlMerge', merge: older, fallback: undefined })).toBe('UnityYAMLMerge');
  });

  it('tells the same tool, or the same editor’s UnityYAMLMerge with the same fallback', () => {
    expect(sameMerger({ kind: 'tool', tool: tool('a') }, { kind: 'tool', tool: tool('a') })).toBe(true);
    expect(sameMerger({ kind: 'unityYamlMerge', merge: newest, fallback: tool('a') }, { kind: 'unityYamlMerge', merge: newest, fallback: tool('b') })).toBe(false);
    expect(sameMerger({ kind: 'unityYamlMerge', merge: newest, fallback: tool('a') }, { kind: 'tool', tool: tool('a') })).toBe(false);
    expect(sameMerger(undefined, { kind: 'tool', tool: tool('a') })).toBe(false);
  });
});
