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
      { version: '1.3.0', heading: null, blocks: [{ kind: 'paragraph', children: [{ kind: 'text', text: 'Shelves' }] }], changelogUrl: null },
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

describe("GitHub's generated notes in the What's New dialog", () => {
  const generated = (body: string) =>
    `<h2>What's Changed</h2>\n${body}\n<p><strong>Full Changelog</strong>: <a href="https://github.com/danipen/uvcs-desktop-client/compare/v0.1.3...v0.2.0"><tt>v0.1.3...v0.2.0</tt></a></p>`;

  it('leaves out the opening "What\'s Changed" heading, which the title already says', () => {
    const [section] = releaseNotesSections([{ version: '0.2.0', html: generated('<ul><li>Shelves</li></ul>') }]);

    expect(section!.blocks).toEqual([{ kind: 'list', ordered: false, items: [{ children: [{ kind: 'text', text: 'Shelves' }] }] }]);
  });

  it('sets the closing "Full Changelog" link apart', () => {
    const [section] = releaseNotesSections([{ version: '0.2.0', html: generated('<p>Shelves</p>') }]);

    expect(section!.changelogUrl).toBe('https://github.com/danipen/uvcs-desktop-client/compare/v0.1.3...v0.2.0');
    expect(section!.blocks).toEqual([{ kind: 'paragraph', children: [{ kind: 'text', text: 'Shelves' }] }]);
  });

  it('keeps notes written by hand as they are: other headings, and a changelog mentioned anywhere but at the end', () => {
    const html = '<h2>Highlights</h2><p><strong>Full Changelog</strong>: <a href="https://example.com/a">a</a></p><p>More</p>';
    const [section] = releaseNotesSections([{ version: '0.2.0', html }]);

    expect(section!.changelogUrl).toBeNull();
    expect(section!.blocks.map((block) => block.kind)).toEqual(['heading', 'paragraph', 'paragraph']);
  });

  it('keeps a "What\'s Changed" heading that follows other notes', () => {
    const [section] = releaseNotesSections([{ version: '0.2.0', html: "<p>Intro</p><h2>What's Changed</h2><p>Shelves</p>" }]);

    expect(section!.blocks.map((block) => block.kind)).toEqual(['paragraph', 'heading', 'paragraph']);
  });
});
