import { describe, expect, it } from 'vitest';
import { fileFamilyOf } from './fileFamily';

describe('fileFamilyOf', () => {
  it('tells the code you write from the files that build it and those generated for you', () => {
    expect(['Player.cs', 'app.ts', 'index.tsx', 'main.py', 'main.go', 'lib.rs', 'Main.java', 'main.cpp', 'util.h', 'Water.shader'].map(fileFamilyOf)).toEqual(
      Array(10).fill('source'),
    );
    expect(['App.csproj', 'App.sln', 'Directory.Build.props', 'build.gradle', 'package.json', 'Cargo.toml', 'CMakeLists.txt', 'Makefile', 'Dockerfile', 'Game.asmdef'].map(fileFamilyOf)).toEqual(
      Array(10).fill('project'),
    );
    expect(['package-lock.json', 'yarn.lock', 'Cargo.lock', 'Player.cs.meta', 'Api.g.cs', 'Form.Designer.cs', 'go.sum'].map(fileFamilyOf)).toEqual(
      Array(7).fill('generated'),
    );
  });

  it('matches names first, whatever their case, then the longest extension', () => {
    expect(fileFamilyOf('PACKAGE.JSON')).toBe('project');
    expect(fileFamilyOf('config.json')).toBe('config');
    expect(fileFamilyOf('Form.designer.CS')).toBe('generated');
    expect(fileFamilyOf('Form.cs')).toBe('source');
    expect(fileFamilyOf('CMakeLists.txt')).toBe('project');
    expect(fileFamilyOf('notes.txt')).toBe('docs');
  });

  it('knows config, docs, images, media, Unity assets, archives, binaries and scripts', () => {
    expect(['app.yaml', 'layout.xml', '.gitignore', 'ignore.conf'].map(fileFamilyOf)).toEqual(Array(4).fill('config'));
    expect(['README.md', 'spec.pdf', 'LICENSE'].map(fileFamilyOf)).toEqual(Array(3).fill('docs'));
    expect(['Hull.PNG', 'Concept.psd'].map(fileFamilyOf)).toEqual(['image', 'image']);
    expect(fileFamilyOf('engine.wav')).toBe('media');
    expect(['Main.unity', 'Ship.prefab', 'Hull.mat', 'GameData.asset', 'ship.fbx', 'Hero.uasset'].map(fileFamilyOf)).toEqual(Array(6).fill('asset'));
    expect(['bundle.zip', 'tools.tar.gz'].map(fileFamilyOf)).toEqual(['archive', 'archive']);
    expect(['Native.dll', 'tool.exe', 'Inter.ttf'].map(fileFamilyOf)).toEqual(Array(3).fill('binary'));
    expect(['build.sh', 'deploy.ps1'].map(fileFamilyOf)).toEqual(['script', 'script']);
  });

  it('leaves unknown types, names without an extension and unknown dotfiles plain', () => {
    expect(fileFamilyOf('notes.xyz')).toBe('plain');
    expect(fileFamilyOf('build')).toBe('plain');
    expect(fileFamilyOf('.hidden')).toBe('plain');
  });
});
