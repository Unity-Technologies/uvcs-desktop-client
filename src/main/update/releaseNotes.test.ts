import { describe, expect, it } from 'vitest';
import { releaseNotesOf } from './releaseNotes';

describe('the notes of an update found', () => {
  it('keeps every release between the running version and the update, newest first as the feed lists them', () => {
    const notes = [
      { version: '1.3.0', note: '<p>Shelves</p>' },
      { version: '1.2.1', note: '<p>A fix</p>' },
    ];

    expect(releaseNotesOf(notes, '1.3.0')).toEqual([
      { version: '1.3.0', html: '<p>Shelves</p>' },
      { version: '1.2.1', html: '<p>A fix</p>' },
    ]);
  });

  it('reads one string as the notes of the update itself', () => {
    expect(releaseNotesOf('<p>Shelves</p>', '1.3.0')).toEqual([{ version: '1.3.0', html: '<p>Shelves</p>' }]);
  });

  it('leaves out the releases published without notes', () => {
    const notes = [
      { version: '1.3.0', note: '' },
      { version: '1.2.1', note: null },
      { version: '1.2.0', note: '<p>Locks</p>' },
    ];

    expect(releaseNotesOf(notes, '1.3.0')).toEqual([{ version: '1.2.0', html: '<p>Locks</p>' }]);
    expect(releaseNotesOf('  \n', '1.3.0')).toEqual([]);
  });

  it('has none when the feed sent none', () => {
    expect(releaseNotesOf(null, '1.3.0')).toEqual([]);
    expect(releaseNotesOf(undefined, '1.3.0')).toEqual([]);
  });
});
