import { describe, expect, it } from 'vitest';
import { readReleaseNote } from './releaseNote';

/** A pull request's body as the template leaves it, with `section` as its release note. */
const body = (section: string) =>
  `## What does this pull request do?\n\nShelves.\n\n## Release note\n\n<!-- Written with the release-notes skill. -->\n\n${section}\n\n## Current behavior\n\nNone.\n`;

describe('a release note', () => {
  it('reads its kind, title and description', () => {
    const section = '### New: Run your own tools on files and branches\n\nAdd them in **Settings › Tools**.\n\n![Tools](https://github.com/user-attachments/assets/1)';

    expect(readReleaseNote(body(section))).toEqual({
      note: {
        kind: 'New',
        title: 'Run your own tools on files and branches',
        description: 'Add them in **Settings › Tools**.\n\n![Tools](https://github.com/user-attachments/assets/1)',
      },
    });
  });

  it('reads every kind', () => {
    for (const kind of ['New', 'Improved', 'Fixed'] as const) {
      expect(readReleaseNote(body(`### ${kind}: A title\n\nA description.`))).toEqual({ note: { kind, title: 'A title', description: 'A description.' } });
    }
  });

  it('says why a pull request has none', () => {
    expect(readReleaseNote(body('None: moves code between services; nothing changes for users.'))).toEqual({
      note: { kind: 'none', reason: 'moves code between services; nothing changes for users.' },
    });
  });

  it('is the last section of the body too', () => {
    expect(readReleaseNote('## Release note\n\n### Fixed: Shelves open\n\nThey open again.')).toEqual({
      note: { kind: 'Fixed', title: 'Shelves open', description: 'They open again.' },
    });
  });

  it('reads a body written on Windows', () => {
    expect(readReleaseNote(body('### Fixed: Shelves open\r\n\r\nThey open again.').replace(/\n/g, '\r\n'))).toEqual({
      note: { kind: 'Fixed', title: 'Shelves open', description: 'They open again.' },
    });
  });

  it('keeps headings, code and tables in the description, even a "##" line inside code', () => {
    const description = '#### Where\n\nIn Settings.\n\n```md\n## Not a section\n```\n\n| Key | Does |\n| --- | --- |\n| ⌘I | Hides it |';

    expect(readReleaseNote(body(`### Improved: Hide the details panel\n\n${description}`))).toEqual({
      note: { kind: 'Improved', title: 'Hide the details panel', description },
    });
  });

  it('keeps the words of other languages and symbols', () => {
    expect(readReleaseNote(body('### Fixed: Árboles con ñ y 日本語 se abren\n\nYa se abren.'))).toEqual({
      note: { kind: 'Fixed', title: 'Árboles con ñ y 日本語 se abren', description: 'Ya se abren.' },
    });
  });
});

describe('a release note CI refuses', () => {
  const problem = (text: string) => ('problem' in readReleaseNote(text) ? (readReleaseNote(text) as { problem: string }).problem : null);

  it('is missing', () => {
    expect(problem('## What does this pull request do?\n\nShelves.')).toMatch(/no "## Release note" section/);
    expect(problem('')).toMatch(/no "## Release note" section/);
  });

  it('is left as the template leaves it', () => {
    expect(problem(body(''))).toMatch(/empty/);
  });

  it('has no kind, or one that is not New, Improved or Fixed', () => {
    expect(problem(body('### Run your own tools\n\nIn Settings.'))).toMatch(/New:, Improved: or Fixed:/);
    expect(problem(body('### Feature: Run your own tools\n\nIn Settings.'))).toMatch(/New:, Improved: or Fixed:/);
    expect(problem(body('Run your own tools in Settings.'))).toMatch(/New:, Improved: or Fixed:/);
  });

  it('has a kind but no title', () => {
    expect(problem(body('### Fixed:\n\nThey open again.'))).toMatch(/title/);
  });

  it('has a title but no description', () => {
    expect(problem(body('### Fixed: Shelves open'))).toMatch(/description/);
  });

  it('holds a second note', () => {
    expect(problem(body('### Fixed: Shelves open\n\nThey open.\n\n### New: Tools\n\nIn Settings.'))).toMatch(/one note/);
  });

  it('says there is none without saying why', () => {
    expect(problem(body('None:'))).toMatch(/why/);
    expect(problem(body('None'))).toMatch(/why/);
  });
});
