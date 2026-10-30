import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { foundUpdateVersion } from './updateReleaseNotes';

describe('foundUpdateVersion', () => {
  it('is the version of an update downloading or ready to install', () => {
    expect(foundUpdateVersion({ state: 'downloading', version: '1.3.0', percent: 20 })).toBe('1.3.0');
    expect(foundUpdateVersion({ state: 'ready', version: '1.3.0', install: 'installer' })).toBe('1.3.0');
  });

  it('is none while no update is found', () => {
    expect(foundUpdateVersion({ state: 'idle' })).toBeNull();
    expect(foundUpdateVersion({ state: 'checking' })).toBeNull();
    expect(foundUpdateVersion({ state: 'upToDate' })).toBeNull();
    expect(foundUpdateVersion({ state: 'failed', error: 'x' })).toBeNull();
    expect(foundUpdateVersion({ state: 'unavailable' })).toBeNull();
  });
});
