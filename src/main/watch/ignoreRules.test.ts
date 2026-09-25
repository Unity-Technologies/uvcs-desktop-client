import { describe, expect, it } from 'vitest';
import { isIgnored, parseIgnoreRules } from './ignoreRules';

const UNITY_IGNORE_CONF = ['# Unity', 'Library', 'Temp/', '/Build/Output', '*.csproj', '**/Logs/*.log', ''].join('\r\n');

describe('parseIgnoreRules', () => {
  const rules = parseIgnoreRules(UNITY_IGNORE_CONF);

  it('ignores names anywhere and rooted paths from the root', () => {
    expect(isIgnored('Library/ShaderCache/a.bin', rules)).toBe(true);
    expect(isIgnored('Packages/Temp', rules)).toBe(true);
    expect(isIgnored('Build/Output/game.exe', rules)).toBe(true);
    expect(isIgnored('Build/Output', rules)).toBe(true);
  });

  it('keeps everything else watched, wildcard rules included', () => {
    expect(isIgnored('Assets/Library.cs', rules)).toBe(false);
    expect(isIgnored('Assets/Build/Output/x', rules)).toBe(false);
    expect(isIgnored('Game.csproj', rules)).toBe(false);
  });

  it('leaves out rules a ! exception mentions', () => {
    const withException = parseIgnoreRules('Library\nTemp\n!Library/keep.txt');
    expect(isIgnored('Library/keep.txt', withException)).toBe(false);
    expect(isIgnored('Temp/x', withException)).toBe(true);
  });
});
