import { describe, expect, it } from 'vitest';
import { incomingPollInterval } from './incomingPollInterval';

describe('incomingPollInterval', () => {
  it('polls every minute with focus, every five behind other apps, never hidden', () => {
    expect(incomingPollInterval(true, true)).toBe(60_000);
    expect(incomingPollInterval(true, false)).toBe(300_000);
    expect(incomingPollInterval(false, false)).toBe(false);
  });
});
