import { describe, expect, it } from 'vitest';
import { changesWorkspace, rewritesChangelists } from './changesWorkspace';

describe('changesWorkspace', () => {
  it('recognizes commands that rewrite the workspace', () => {
    expect(changesWorkspace(['checkin', '/ws/a.txt', '--machinereadable'])).toBe(true);
    expect(changesWorkspace(['undo', '/ws/a.txt'])).toBe(true);
    expect(changesWorkspace(['merge', 'br:/main/task', '--merge'])).toBe(true);
    expect(changesWorkspace(['shelveset', 'apply', 'sh:3'])).toBe(true);
    expect(changesWorkspace(['changelist', 'default', 'add', '/ws/a.txt'])).toBe(true);
    expect(changesWorkspace(['undelete', 'revid:18', '/ws/src/Enemy.cs'])).toBe(true);
    expect(changesWorkspace(['xlink', '-w', '/ws/lib', '/', 'cs:4@lib@local'])).toBe(true);
    expect(changesWorkspace(['xlink', '--addrules', '/ws/lib', 'br:/main-br:/main/dev'])).toBe(true);
  });

  it('leaves out reads and previews', () => {
    expect(changesWorkspace(['status', '--xml'])).toBe(false);
    expect(changesWorkspace(['merge', 'br:/main/task', '--machinereadable'])).toBe(false);
    expect(changesWorkspace(['shelveset', 'apply', 'sh:3', '--preview'])).toBe(false);
    expect(changesWorkspace(['changelist'])).toBe(false);
    expect(changesWorkspace(['label', 'create', 'lb:v1'])).toBe(false);
    expect(changesWorkspace(['xlink', '--show', '/ws/lib'])).toBe(false);
    expect(changesWorkspace(['xlink', '-s', '/ws/lib'])).toBe(false);
  });
});

describe('rewritesChangelists', () => {
  it('recognizes the status read that writes the changelist files back', () => {
    expect(rewritesChangelists(['status', '--xml', '--iscochanged', '--changelists', '--private'])).toBe(true);
    expect(rewritesChangelists(['status', '--short'])).toBe(false);
    expect(rewritesChangelists(['changelist'])).toBe(false);
  });
});
