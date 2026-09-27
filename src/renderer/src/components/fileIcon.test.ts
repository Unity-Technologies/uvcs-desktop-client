import { describe, expect, it } from 'vitest';
import { fileIconOf } from './fileIcon';

const iconOf = (name: string): string | undefined => fileIconOf(name)?.dark;

describe('fileIconOf', () => {
  it('gives code, data, documents and media their icons, whatever the case of the extension', () => {
    expect(iconOf('PlayerController.cs')).toBe('csharp');
    expect(iconOf('App.CSPROJ')).toBe('visualstudio');
    expect(iconOf('main.cpp')).toBe('cpp');
    expect(iconOf('index.tsx')).toBe('react_ts');
    expect(iconOf('config.yaml')).toBe('yaml');
    expect(iconOf('Hull.PNG')).toBe('image');
    expect(iconOf('engine.wav')).toBe('audio');
    expect(iconOf('Native.dll')).toBe('dll');
  });

  it('knows well-known file names before their extension', () => {
    expect(iconOf('package.json')).not.toBe(iconOf('manifest.json'));
    expect(iconOf('Dockerfile')).toBe('docker');
    expect(iconOf('CMakeLists.txt')).toBe('cmake');
    expect(iconOf('README.md')).toBe('readme');
    expect(iconOf('.gitignore')).toBe('git');
  });

  it("shows Unity's scenes, prefabs and assets as Unity's, and Plastic's configuration as Plastic's", () => {
    expect(iconOf('Main.unity')).toBe('unity');
    expect(iconOf('Ship.prefab')).toBe('unity');
    expect(iconOf('Hull.mat')).toBe('unity');
    expect(iconOf('ship.fbx')).toBe('3d');
    expect(iconOf('Water.shadergraph')).toBe('shader');
    expect(iconOf('ignore.conf')).toBe('plastic');
  });

  it("leaves Unity's .meta files, unknown extensions and names without one to the plain page", () => {
    expect(fileIconOf('Player.cs.meta')).toBeNull();
    expect(fileIconOf('notes.xyz')).toBeNull();
    expect(fileIconOf('build')).toBeNull();
  });

  it('takes the variant drawn for light themes where the theme has one', () => {
    expect(fileIconOf('Concept.psd')).toEqual({ dark: 'adobe-photoshop', light: 'adobe-photoshop_light' });
    expect(fileIconOf('Player.cs')).toEqual({ dark: 'csharp', light: 'csharp' });
  });
});
