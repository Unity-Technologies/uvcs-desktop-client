import { describe, expect, it } from 'vitest';
import { changesWorkspace } from './changesWorkspace';

describe('changesWorkspace', () => {
  it('recognizes commands that rewrite the workspace', () => {
    expect(changesWorkspace(['checkin', '/ws/a.txt', '--machinereadable'])).toBe(true);
    expect(changesWorkspace(['undo', '/ws/a.txt'])).toBe(true);
    expect(changesWorkspace(['merge', 'br:/main/task', '--merge'])).toBe(true);
    expect(changesWorkspace(['shelveset', 'apply', 'sh:3'])).toBe(true);
    expect(changesWorkspace(['changelist', 'default', 'add', '/ws/a.txt'])).toBe(true);
  });

  it('leaves out reads and previews', () => {
    expect(changesWorkspace(['status', '--xml'])).toBe(false);
    expect(changesWorkspace(['merge', 'br:/main/task', '--machinereadable'])).toBe(false);
    expect(changesWorkspace(['shelveset', 'apply', 'sh:3', '--preview'])).toBe(false);
    expect(changesWorkspace(['changelist'])).toBe(false);
    expect(changesWorkspace(['label', 'create', 'lb:v1'])).toBe(false);
  });
});
