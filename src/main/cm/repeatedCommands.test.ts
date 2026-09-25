import { describe, expect, it } from 'vitest';
import { isServerCommand, RepeatedCommandDetector } from './repeatedCommands';

describe('isServerCommand', () => {
  it('tells server queries from reads of this machine', () => {
    expect(isServerCommand(['find', 'branch', '--xml'])).toBe(true);
    expect(isServerCommand(['diff', 'cs:4'])).toBe(true);
    expect(isServerCommand(['workspace', 'create', 'wk', '/tmp/wk'])).toBe(true);
    expect(isServerCommand(['status', '--header', '--xml'])).toBe(false);
    expect(isServerCommand(['getworkspacefrompath', '/wk'])).toBe(false);
    expect(isServerCommand(['workspace', 'list'])).toBe(false);
  });
});

describe('RepeatedCommandDetector', () => {
  const budget = { maxRuns: 2, windowMs: 10_000 };

  it('flags the run that goes over the budget, once per burst', () => {
    const detector = new RepeatedCommandDetector(budget);
    expect([0, 1000, 2000, 3000].map((at) => detector.record('cm find branch', at))).toEqual([false, false, true, false]);
  });

  it('counts only the runs within the window', () => {
    const detector = new RepeatedCommandDetector(budget);
    expect([0, 6000, 12_000, 18_000].map((at) => detector.record('cm find branch', at))).toEqual([false, false, false, false]);
  });

  it('counts each command apart', () => {
    const detector = new RepeatedCommandDetector(budget);
    expect(['a', 'b', 'a', 'b'].map((command, index) => detector.record(command, index))).toEqual([false, false, false, false]);
  });
});
