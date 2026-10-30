import { describe, expect, it } from 'vitest';
import { fullChangelogLine, generatedItem, generatedNotes, group, note, paragraph } from './testing/releaseNotesHtml';
import { whatsNewRelease, type WhatsNewRelease } from './whatsNewRelease';
import { filterChips, hasWhatsNew, releaseSections, toggledRelease, whatsNewBody, whatsNewSubtitle } from './whatsNewView';

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

  it('tones each group by its kind', () => {
    const [section] = releaseSections([newest, generated], 'all', new Set());
    const unfoldedGenerated = releaseSections([newest, generated], 'all', new Set(['0.2.3']))[1]!;

    expect(section!.groups.map(({ kind, tone }) => ({ kind, tone }))).toEqual([
      { kind: 'new', tone: 'success' },
      { kind: 'improved', tone: 'accent' },
      { kind: 'fixed', tone: 'warning' },
    ]);
    expect(unfoldedGenerated.groups[0]!.tone).toBe('neutral');
  });
});

describe('releases with nothing to show', () => {
  const onlyChangelog = whatsNewRelease({ version: '0.2.6', html: fullChangelogLine('0.2.5', '0.2.6') });
  const onlyNewContributors = whatsNewRelease({
    version: '0.2.1',
    html: `<h2>New Contributors</h2>\n<ul><li><a href="https://github.com/ana">@ana</a> made their first contribution</li></ul>\n${fullChangelogLine('0.2.0', '0.2.1')}`,
  });

  it('are left out, a release after the update with none shown as a row', () => {
    expect(summary([newest, onlyNewContributors, onlyFixes], 'all').map(({ version }) => version)).toEqual(['0.2.5', '0.2.4']);
  });

  it("open the first release that has some when the update's own has none, named by its row", () => {
    expect(summary([onlyChangelog, onlyFixes, generated], 'all')).toEqual([
      { version: '0.2.4', row: { version: '0.2.4', count: '2 notes', foldable: false }, open: true, intro: 1, groups: ['Fixed: 2'] },
      { version: '0.2.3', row: { version: '0.2.3', count: '1 note', foldable: true }, open: false, intro: 0, groups: ['Other changes: 1'] },
    ]);
  });

  it("make What's New empty when none has any, and offer no What's New", () => {
    expect(whatsNewBody([onlyChangelog, onlyNewContributors], 'all', new Set())).toEqual({ kind: 'empty' });
    expect(whatsNewBody([], 'all', new Set())).toEqual({ kind: 'empty' });
    expect(hasWhatsNew([onlyChangelog, onlyNewContributors])).toBe(false);
    expect(hasWhatsNew([])).toBe(false);
  });

  it("offer What's New when any release has something, plain notes too", () => {
    expect(hasWhatsNew([onlyChangelog, plain])).toBe(true);
    expect(whatsNewBody([onlyChangelog, plain], 'all', new Set()).kind).toBe('releases');
  });
});

describe("What's New's subtitle", () => {
  it('says the version running and the day the update was released', () => {
    expect(whatsNewSubtitle('0.2.4', '2026-10-30T23:30:00Z', { locale: 'en-US', timeZone: 'UTC' })).toEqual(['You have 0.2.4', 'Released October 30, 2026']);
    expect(whatsNewSubtitle('0.2.4', '2026-10-30T23:30:00Z', { locale: 'en-US', timeZone: 'Asia/Tokyo' })).toEqual([
      'You have 0.2.4',
      'Released October 31, 2026',
    ]);
  });

  it('leaves out what it does not know yet', () => {
    expect(whatsNewSubtitle(undefined, null)).toEqual([]);
    expect(whatsNewSubtitle('0.2.4', 'not a date')).toEqual(['You have 0.2.4']);
  });
});
