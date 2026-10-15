import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { folderIsThere } from './folderIsThere';

afterEach(() => {
  vi.useRealTimers();
});

describe('folderIsThere', () => {
  it('finds a folder that is there, and not one that is gone', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'uvcs-there-'));

    expect(await folderIsThere(folder)).toBe(true);
    expect(await folderIsThere(join(folder, 'gone'))).toBe(false);
  });

  it('counts a folder on a drive that does not answer in time as there, without waiting for the drive', async () => {
    vi.useFakeTimers();
    const unanswered = (_path: string) => new Promise<void>(() => undefined);
    let answer: boolean | undefined;

    void folderIsThere('\\\\fileserver\\work\\game', { find: unanswered, waitMs: 300 }).then((there) => (answer = there));
    await vi.advanceTimersByTimeAsync(299);
    expect(answer).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(answer).toBe(true);
  });

  it('answers as soon as the drive does', async () => {
    vi.useFakeTimers();
    const missing = (_path: string) => Promise.reject(new Error('ENOENT'));

    const answer = folderIsThere('Z:\\work\\game', { find: missing, waitMs: 300 });
    await vi.advanceTimersByTimeAsync(0);
    expect(await answer).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
