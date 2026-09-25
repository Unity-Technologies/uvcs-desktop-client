import { describe, expect, it } from 'vitest';
import { isUnseenFailure } from './unseenFailure';

describe('isUnseenFailure', () => {
  const none = new Set<number>();

  it('is a failed command logged after the log was looked at', () => {
    expect(isUnseenFailure({ id: 5, exitCode: 1 }, 4, none)).toBe(true);
  });

  it('ignores successful commands and those already seen', () => {
    expect(isUnseenFailure({ id: 5, exitCode: 0 }, 4, none)).toBe(false);
    expect(isUnseenFailure({ id: 5, exitCode: 1 }, 5, none)).toBe(false);
  });

  it('ignores failures an operation dealt with, like a rejected checkin it retried', () => {
    expect(isUnseenFailure({ id: 5, exitCode: 1 }, 4, new Set([5]))).toBe(false);
  });
});
