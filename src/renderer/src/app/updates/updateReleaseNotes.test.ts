import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { foundUpdateVersion, releaseNotesSections } from './updateReleaseNotes';

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

describe("the What's New dialog", () => {
  it('shows the notes of one release under the title alone', () => {
    expect(releaseNotesSections([{ version: '1.3.0', html: '<p>Shelves</p>' }])).toEqual([
      { version: '1.3.0', heading: null, blocks: [{ kind: 'paragraph', children: [{ kind: 'text', text: 'Shelves' }] }] },
    ]);
  });

  it('names each release when the update skips a few, newest first', () => {
    const sections = releaseNotesSections([
      { version: '1.3.0', html: '<p>Shelves</p>' },
      { version: '1.2.1', html: '<p>A fix</p>' },
    ]);

    expect(sections.map(({ version, heading }) => ({ version, heading }))).toEqual([
      { version: '1.3.0', heading: 'Version 1.3.0' },
      { version: '1.2.1', heading: 'Version 1.2.1' },
    ]);
  });
});
