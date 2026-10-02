import { describe, expect, it, vi } from 'vitest';
import { INSTALLED_APPS_RECHECK_MS, InstalledAppsCache, NO_INSTALLED_APPS, type InstalledApps } from './installedApps';

const withZed: InstalledApps = { ...NO_INSTALLED_APPS, bundles: new Map([['dev.zed.Zed', '/Applications/Zed.app']]) };

describe('InstalledAppsCache', () => {
  it('reads once for every caller until the records are old, then again', async () => {
    let now = 0;
    const read = vi.fn(async () => withZed);
    const cache = new InstalledAppsCache(read, () => now);
    await Promise.all([cache.get(), cache.get()]);
    now = INSTALLED_APPS_RECHECK_MS - 1;
    await cache.get();
    expect(read).toHaveBeenCalledTimes(1);
    now = INSTALLED_APPS_RECHECK_MS;
    expect(await cache.get()).toBe(withZed);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('answers no records when the OS can’t be asked, and asks again next time', async () => {
    const read = vi.fn<() => Promise<InstalledApps>>().mockRejectedValueOnce(new Error('mdfind: no such file')).mockResolvedValue(withZed);
    const cache = new InstalledAppsCache(read, () => 0);
    expect(await cache.get()).toBe(NO_INSTALLED_APPS);
    expect(await cache.get()).toBe(withZed);
  });
});
