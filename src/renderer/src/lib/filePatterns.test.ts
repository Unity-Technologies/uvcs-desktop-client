import { describe, expect, it } from 'vitest';
import { fileNamesIgnoreCase, formatFilePatterns, matchesAnyFilePattern, matchesFilePattern } from './filePatterns';
import { allTokens } from './tokenInput';

const matches = (pattern: string, path: string, ignoreCase = false): boolean => matchesFilePattern(pattern, path, ignoreCase);

describe('formatFilePatterns', () => {
  it('quotes what holds a separator, so the token field reads it back, imported patterns included', () => {
    const patterns = ['.cs', 'Assets/**', 'Assets/Third Party/**', 'My Level.unity', 'a,b.txt'];
    expect(formatFilePatterns(patterns)).toBe('.cs Assets/** "Assets/Third Party/**" "My Level.unity" "a,b.txt"');
    expect(allTokens(formatFilePatterns(patterns))).toEqual(patterns);
  });
});

describe('matchesFilePattern', () => {
  it('matches an extension in any folder, and only at the end of the name', () => {
    expect(matches('.cs', 'Assets/Scripts/Player.cs')).toBe(true);
    expect(matches('.cs', 'Player.cs')).toBe(true);
    expect(matches('.cs', 'Player.csproj')).toBe(false);
    expect(matches('.cs', 'Player.cs.meta')).toBe(false);
  });

  it('matches a wildcard name against the name alone: * and ? never cross folders', () => {
    expect(matches('*.prefab', 'Assets/Prefabs/Hero.prefab')).toBe(true);
    expect(matches('Level?.unity', 'Assets/Level1.unity')).toBe(true);
    expect(matches('Level?.unity', 'Assets/Level10.unity')).toBe(false);
    expect(matches('Hero*', 'Assets/Hero/Body.fbx')).toBe(false);
  });

  it('matches a pattern with a folder against the path from the root, ** crossing folders', () => {
    expect(matches('Assets/Data/**', 'Assets/Data/Levels/one.json')).toBe(true);
    expect(matches('Assets/**/*.json', 'Assets/one.json')).toBe(true);
    expect(matches('Assets/**/*.json', 'Assets/Data/Levels/one.json')).toBe(true);
    expect(matches('Assets/*.json', 'Assets/Data/one.json')).toBe(false);
    expect(matches('Assets/**/*.json', 'Packages/Assets/one.json')).toBe(false);
  });

  it('reads a path starting with a dot as that folder, not as an extension', () => {
    expect(matches('.github/**', '.github/workflows/ci.yml')).toBe(true);
    expect(matches('.github/**', 'docs.github/x')).toBe(false);
  });

  it('matches a path with spaces', () => {
    expect(matches('Assets/Third Party/**', 'Assets/Third Party/Plugin/a.cs')).toBe(true);
  });

  it('takes the path with a leading slash or Windows separators alike', () => {
    expect(matches('/Assets/*.json', '/Assets/one.json')).toBe(true);
    expect(matches('Assets\\*.json', 'Assets\\one.json')).toBe(true);
  });

  it('matches any file with *', () => {
    expect(matches('*', 'Assets/Scripts/Player.cs')).toBe(true);
  });

  it('reads the characters regular expressions use as themselves', () => {
    expect(matches('.c++', 'src/main.c++')).toBe(true);
    expect(matches('(old).txt', 'notes/(old).txt')).toBe(true);
    expect(matches('a.b', 'aXb')).toBe(false);
  });

  it('matches names in any case where the OS does, and exactly on Linux', () => {
    expect(matches('.CS', 'Player.cs', fileNamesIgnoreCase('win32'))).toBe(true);
    expect(matches('.cs', 'Player.CS', fileNamesIgnoreCase('darwin'))).toBe(true);
    expect(matches('.cs', 'Player.CS', fileNamesIgnoreCase('linux'))).toBe(false);
  });

  it('matches non-ASCII names', () => {
    expect(matches('*.txt', 'Docs/Ñandú.txt')).toBe(true);
  });
});

describe('matchesAnyFilePattern', () => {
  it('matches when one pattern does, and never with none', () => {
    expect(matchesAnyFilePattern(['.vb', '.cs'], 'Player.cs', false)).toBe(true);
    expect(matchesAnyFilePattern([], 'Player.cs', false)).toBe(false);
  });
});
