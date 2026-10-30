import { describe, expect, it } from 'vitest';
import { generatedItem, generatedNotes, group, note, paragraph } from './testing/releaseNotesHtml';
import { whatsNewRelease, type WhatsNewRelease } from './whatsNewRelease';
import { filterChips, releaseSections, toggledRelease, whatsNewSubtitle } from './whatsNewView';

const newest = whatsNewRelease({
  version: '0.2.5',
  html: [group('New'), note('Tools'), note('Mentions'), group('Improved'), note('Details panel'), group('Fixed'), note('Closing a window')].join('\n'),
  releaseDate: '2026-10-30T12:00:00Z',
});
const onlyFixes = whatsNewRelease({ version: '0.2.4', html: [paragraph('A quick one.'), group('Fixed'), note('Initials'), note('Locks')].join('\n') });
const generated = whatsNewRelease({ version: '0.2.3', html: generatedNotes([generatedItem('Shelves open from the palette', 'ana', 12)]) });
const plain = whatsNewRelease({ version: '0.2.2', html: paragraph('Faster start.') });

const summary = (releases: WhatsNewRelease[], filter: Parameters<typeof releaseSections>[1], unfolded = new Set<string>()) =>
  releaseSections(releases, filter, unfolded).map(({ version, row, open, intro, groups }) => ({
    version,
    row,
    open,
    intro: intro.length,
    groups: groups.map((noteGroup) => `${noteGroup.label}: ${noteGroup.notes.length}`),
  }));

describe("What's New's filter", () => {
  it('counts each kind of note across every release, All first, and other changes only when there are some', () => {
    expect(filterChips([newest, onlyFixes])).toEqual([
      { filter: 'all', label: 'All', count: 6 },
      { filter: 'new', label: 'New', count: 2 },
      { filter: 'improved', label: 'Improved', count: 1 },
      { filter: 'fixed', label: 'Fixed', count: 3 },
    ]);
    expect(filterChips([newest, onlyFixes, generated]).at(-1)).toEqual({ filter: 'other', label: 'Other changes', count: 1 });
  });

  it('shows no chips when the notes hold one kind, or none', () => {
    expect(filterChips([onlyFixes])).toEqual([]);
    expect(filterChips([generated, plain])).toEqual([]);
    expect(filterChips([])).toEqual([]);
  });
});

describe("What's New's releases", () => {
  it("shows one release open under the title, its notes grouped in the releases' order", () => {
    expect(summary([newest], 'all')).toEqual([
      { version: '0.2.5', row: null, open: true, intro: 0, groups: ['New: 2', 'Improved: 1', 'Fixed: 1'] },
    ]);
  });

  it('folds the releases after the newest into rows that count their notes, until the user unfolds one', () => {
    const releases = [newest, onlyFixes, generated, plain];

    expect(summary(releases, 'all', new Set(['0.2.3']))).toEqual([
      { version: '0.2.5', row: null, open: true, intro: 0, groups: ['New: 2', 'Improved: 1', 'Fixed: 1'] },
      { version: '0.2.4', row: { version: '0.2.4', count: '2 notes', foldable: true }, open: false, intro: 1, groups: ['Fixed: 2'] },
      { version: '0.2.3', row: { version: '0.2.3', count: '1 note', foldable: true }, open: true, intro: 0, groups: ['Other changes: 1'] },
      { version: '0.2.2', row: { version: '0.2.2', count: '', foldable: true }, open: false, intro: 1, groups: [] },
    ]);
  });

  it("under a filter, shows that kind from every release at once, leaving out the releases without any and what's outside the notes", () => {
    expect(summary([newest, onlyFixes, generated, plain], 'fixed')).toEqual([
      { version: '0.2.5', row: null, open: true, intro: 0, groups: ['Fixed: 1'] },
      { version: '0.2.4', row: { version: '0.2.4', count: '2 notes', foldable: false }, open: true, intro: 0, groups: ['Fixed: 2'] },
    ]);
  });

  it("names the first release shown when the filter leaves out the update's own", () => {
    expect(summary([newest, generated], 'other')).toEqual([
      { version: '0.2.3', row: { version: '0.2.3', count: '1 note', foldable: false }, open: true, intro: 0, groups: ['Other changes: 1'] },
    ]);
  });

  it('keeps the releases the user unfolded when the filter goes back to All', () => {
    const unfolded = toggledRelease(new Set(), '0.2.4');

    expect(summary([newest, onlyFixes], 'all', unfolded)[1]!.open).toBe(true);
    expect(toggledRelease(unfolded, '0.2.4')).toEqual(new Set());
  });
});

describe("What's New's subtitle", () => {
  it('says the version running and the day the update was released', () => {
    expect(whatsNewSubtitle('0.2.4', '2026-10-30T12:00:00Z', 'en-US')).toEqual(['You have 0.2.4', 'Released October 30, 2026']);
    expect(whatsNewSubtitle('0.2.4', '2026-10-30T12:00:00Z', 'es-ES')).toEqual(['You have 0.2.4', 'Released 30 de octubre de 2026']);
  });

  it('leaves out what it does not know yet', () => {
    expect(whatsNewSubtitle(undefined, null)).toEqual([]);
    expect(whatsNewSubtitle('0.2.4', 'not a date')).toEqual(['You have 0.2.4']);
  });
});
