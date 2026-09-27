import { describe, expect, it, vi } from 'vitest';
import { untilSucceeded } from './untilSucceeded';

describe('untilSucceeded', () => {
  it('reads once for calls made while the read runs and after it succeeded', async () => {
    const read = vi.fn(async () => 'cm 11.0');
    const version = untilSucceeded(read);
    await expect(Promise.all([version(), version()])).resolves.toEqual(['cm 11.0', 'cm 11.0']);
    await expect(version()).resolves.toBe('cm 11.0');
    expect(read).toHaveBeenCalledOnce();
  });

  it('reads again after a failure or an answer that is not a success', async () => {
    const read = vi
      .fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(new Error('cm not found'))
      .mockResolvedValueOnce('not signed in')
      .mockResolvedValue(null);
    const problem = untilSucceeded(read, (answer) => answer === null);
    await expect(problem()).rejects.toThrow('cm not found');
    await expect(problem()).resolves.toBe('not signed in');
    await expect(problem()).resolves.toBeNull();
    await expect(problem()).resolves.toBeNull();
    expect(read).toHaveBeenCalledTimes(3);
  });
});
