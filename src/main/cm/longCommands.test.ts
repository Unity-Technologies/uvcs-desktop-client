import { describe, expect, it } from 'vitest';
import { MAX_QUICK_WRITE_PATHS, runsLong } from './longCommands';

const paths = (count: number): string[] => Array.from({ length: count }, (_, index) => `/ws/file${index}.txt`);

describe('runsLong', () => {
  it('keeps reads quick, however much they read', () => {
    expect(runsLong(['status', '--xml', '--iscochanged', '--changelists'])).toBe(false);
    expect(runsLong(['find', 'changeset', 'where branch = /main', '--xml'])).toBe(false);
    expect(runsLong(['merge', 'br:/main/task', '--machinereadable'])).toBe(false);
    expect(runsLong(['ls', ...paths(200)])).toBe(false);
  });

  it('keeps small writes quick', () => {
    expect(runsLong(['undo', ...paths(3), '--symlink'])).toBe(false);
    expect(runsLong(['add', '--coparent', ...paths(MAX_QUICK_WRITE_PATHS)])).toBe(false);
    expect(runsLong(['label', 'create', 'lb:v1', 'cs:12'])).toBe(false);
    expect(runsLong(['branch', 'rename', 'br:/main/a', 'b'])).toBe(false);
  });

  it('takes writes of many paths as long', () => {
    expect(runsLong(['undo', ...paths(MAX_QUICK_WRITE_PATHS + 1), '--symlink'])).toBe(true);
    expect(runsLong(['checkout', ...paths(500)])).toBe(true);
    expect(runsLong(['changelist', 'default', 'add', ...paths(MAX_QUICK_WRITE_PATHS)])).toBe(true);
  });

  it('takes recursive writes as long', () => {
    expect(runsLong(['undo', '--unchanged', '-r', '/ws'])).toBe(true);
    expect(runsLong(['add', '-R', '--coparent', '/ws/assets'])).toBe(true);
  });

  it('takes transfers as long, even of one file', () => {
    expect(runsLong(['update', '--forcedetailedprogress'])).toBe(true);
    expect(runsLong(['checkin', '/ws/a.txt', '--machinereadable'])).toBe(true);
    expect(runsLong(['merge', 'br:/main/task', '--merge'])).toBe(true);
  });
});
