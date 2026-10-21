import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isIgnored, NO_IGNORE_RULES, parseIgnoreRules, readIgnoreRules } from './ignoreRules';

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

describe('readIgnoreRules', () => {
  const workspaces: string[] = [];
  const newWorkspace = (): string => {
    const workspace = mkdtempSync(join(tmpdir(), 'ignore-rules-'));
    workspaces.push(workspace);
    return workspace;
  };
  afterEach(() => workspaces.splice(0).forEach((workspace) => rmSync(workspace, { recursive: true, force: true })));

  it("reads the rules of the workspace's ignore.conf", () => {
    const workspace = newWorkspace();
    writeFileSync(join(workspace, 'ignore.conf'), UNITY_IGNORE_CONF);
    expect(readIgnoreRules(workspace)).toEqual(parseIgnoreRules(UNITY_IGNORE_CONF));
  });

  it('ignores nothing in a workspace without one', () => {
    expect(readIgnoreRules(newWorkspace())).toEqual(NO_IGNORE_RULES);
  });
});
