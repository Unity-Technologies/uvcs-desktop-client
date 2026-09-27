import { describe, expect, it } from 'vitest';
import { fileKindOf } from './fileKind';

describe('fileKindOf', () => {
  it('tells families apart by extension, whatever its case', () => {
    expect(fileKindOf('PlayerController.cs')).toBe('code');
    expect(fileKindOf('manifest.json')).toBe('data');
    expect(fileKindOf('README.md')).toBe('text');
    expect(fileKindOf('Hull.PNG')).toBe('image');
    expect(fileKindOf('engine.wav')).toBe('media');
    expect(fileKindOf('tools.tar.gz')).toBe('archive');
    expect(fileKindOf('NativeAudio.dll')).toBe('binary');
  });

  it("knows Unity's scenes, prefabs, assets and their .meta files", () => {
    expect(fileKindOf('Main.unity')).toBe('asset');
    expect(fileKindOf('Ship.prefab')).toBe('asset');
    expect(fileKindOf('ship.fbx')).toBe('asset');
    expect(fileKindOf('Ship.prefab.meta')).toBe('meta');
  });

  it('is plain for names without an extension, dotfiles and unknown extensions', () => {
    expect(fileKindOf('Makefile')).toBe('plain');
    expect(fileKindOf('.gitignore')).toBe('plain');
    expect(fileKindOf('notes.xyz')).toBe('plain');
  });
});
