import { describe, expect, it } from 'vitest';
import type { MergeTool } from '@shared/domain/mergeTools';
import { mergeToolFor, type MergeToolSetup } from './mergeToolFor';

const tool = (id: string): MergeTool => ({ id, name: id, origin: 'known', executable: id, args: [], defaultArgs: [], canBringToFront: false });

const setup: MergeToolSetup = {
  tools: [tool('uvcs'), tool('semantic'), tool('rider'), tool('kdiff3')],
  preferredId: 'uvcs',
  rules: [
    { id: 'shaders', patterns: ['.shader', '.hlsl'], toolId: 'rider' },
    { id: 'code', patterns: ['.cs', '.vb', '.java'], toolId: 'semantic' },
    { id: 'all-code', patterns: ['.cs'], toolId: 'kdiff3' },
  ],
  unityMergeTool: 'others',
  ignoreCase: true,
};
const toolOf = (path: string, changes: Partial<MergeToolSetup> = {}, unityAsset = false): string | undefined => mergeToolFor({ path, unityAsset }, { ...setup, ...changes })?.id;

describe('mergeToolFor', () => {
  it('opens a file in the first rule that matches it, else in every other file’s tool', () => {
    expect(toolOf('Assets/Shaders/Water.hlsl')).toBe('rider');
    expect(toolOf('Assets/Scripts/Player.cs')).toBe('semantic');
    expect(toolOf('README.md')).toBe('uvcs');
  });

  it('passes by a rule whose tool isn’t found here', () => {
    expect(toolOf('Assets/Scripts/Player.cs', { tools: [tool('uvcs'), tool('kdiff3')] })).toBe('kdiff3');
    expect(toolOf('Assets/Shaders/Water.hlsl', { tools: [tool('uvcs')] })).toBe('uvcs');
  });

  it('matches names in any case where the OS does, and exactly where it doesn’t', () => {
    expect(toolOf('Player.CS')).toBe('semantic');
    expect(toolOf('Player.CS', { ignoreCase: false })).toBe('uvcs');
  });

  it('opens a Unity asset in its own tool when one is picked, else as any other file', () => {
    expect(toolOf('Assets/Hero.prefab', { unityMergeTool: 'kdiff3' }, true)).toBe('kdiff3');
    expect(toolOf('Assets/Hero.prefab', {}, true)).toBe('uvcs');
    expect(toolOf('Assets/Hero.prefab', { rules: [{ id: 'p', patterns: ['*.prefab'], toolId: 'rider' }] }, true)).toBe('rider');
    expect(toolOf('Assets/Hero.prefab', { unityMergeTool: 'gone' }, true)).toBe('uvcs');
    expect(toolOf('Assets/Hero.prefab', { unityMergeTool: 'kdiff3' }, false)).toBe('uvcs');
  });

  it('falls back to the first tool when every other file’s is gone, and to none without tools', () => {
    expect(toolOf('README.md', { preferredId: null, tools: [tool('kdiff3')] })).toBe('kdiff3');
    expect(toolOf('README.md', { preferredId: null, tools: [] })).toBeUndefined();
  });
});
