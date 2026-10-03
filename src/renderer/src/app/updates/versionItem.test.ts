import { describe, expect, it } from 'vitest';
import { versionItem } from './versionItem';

describe('versionItem', () => {
  it('shows the running version, which opens About to check for updates', () => {
    for (const state of ['idle', 'checking', 'upToDate', 'unavailable'] as const) {
      expect(versionItem('1.4.2', { state })).toEqual({ label: 'v1.4.2', tip: 'About Unity Version Control', detail: 'Check for updates', updateReady: false });
    }
    expect(versionItem('1.4.2', { state: 'failed', error: 'offline' }).label).toBe('v1.4.2');
  });

  it('stays the running version while an update downloads: the update card shows its progress', () => {
    expect(versionItem('1.4.2', { state: 'downloading', version: '1.5.0', percent: 40 }).updateReady).toBe(false);
  });

  it('says an update is ready until it installs, even once its card was put off', () => {
    const expected = { label: 'Update ready', tip: 'Version 1.5.0 is ready to install', detail: 'Running 1.4.2', updateReady: true };
    expect(versionItem('1.4.2', { state: 'ready', version: '1.5.0', install: 'restart' })).toEqual(expected);
    expect(versionItem('1.4.2', { state: 'waitingToInstall', version: '1.5.0', install: 'installer' })).toEqual(expected);
  });
});
