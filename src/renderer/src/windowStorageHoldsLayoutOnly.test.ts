import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

// A window's storage (`localStorage`, through zustand's `persist`) holds only how the views are laid out: what costs a
// click to set again, and what two windows may overwrite in each other without anyone losing anything. What the user
// chose or built up, and anything kept per repository, workspace or server, lives in the app's settings
// (`AppSettings`, `RepositorySettings`), which the main process changes one value at a time (ARCHITECTURE.md "Where a
// setting is kept"). Each window keeps its own copy of a stored store and writes all of it back on any change, so a map
// of places there loses what another window added meanwhile.

/** Every source that keeps a store in the window's storage, and why what it keeps is only layout. */
const LAYOUT_STORES: Record<string, string> = {
  'ui/detailsLayoutStore.ts': 'the height of a details panel’s changes and which of its sections are open',
  'components/detailsPaneStore.ts': 'the width of each splitter and details panel, and which are hidden',
  'components/fileListViewStore.ts': 'how the file lists are laid out, sorted and grouped',
  'components/changesetList/changesetListHeightStore.ts': 'the height of a changeset list',
  'app/shell/sidebarStore.ts': 'whether the sidebar is collapsed',
  'app/shell/commandLogStore.ts': 'the command log’s height and filter',
  'app/home/deletedRepositoriesStore.ts': 'whether the home screen lists deleted repositories',
  'features/pendingChanges/pendingChangesViewStore.ts': 'how Changes groups its files, and the height of its comment',
  'features/diff/changesetListFoldStore.ts': 'whether a branch diff shows its changesets',
  'features/diff/viewer/diffPreferencesStore.ts': 'how diffs are shown: side by side or inline, wrapped, the image and model modes',
  'features/annotate/annotateOptionsStore.ts': 'which columns Annotate shows',
  'features/codeReviews/inline/reviewCommentsStore.ts': 'whether review comments show in the code, and their order',
  'features/codeReviews/suggestions/suggestionViewStore.ts': 'how a suggested change is shown',
  'features/history/revisionView.ts': 'how History shows a revision',
  'features/incoming/incomingViewStore.ts': 'whether Incoming shows its changesets',
  'features/branchExplorer/branchExplorerStore.ts': 'the Branch Explorer’s date range, filters and display options',
  'lib/viewFilters.ts': 'every view’s filters: time range, kinds, Mine',
};

/**
 * The maps a stored store keeps (a field typed `Record<string, …>`), by `file#field`, and what they're keyed by. A map
 * of places (`picks` by server) once hid behind an innocent name, so every map is named here, not only `*ByRepository`.
 */
const KEYED_MAPS: Record<string, string> = {
  'components/detailsPaneStore.ts#widths': 'by splitter or details panel (`widthKey`, `detailsKey`)',
  'components/detailsPaneStore.ts#hidden': 'by details panel (`detailsKey`)',
  'components/detailsPaneStore.ts#startedHidden': 'by details panel, for the session only: not remembered (`partialize`)',
  'features/diff/viewer/diffPreferencesStore.ts#representations': 'by kind of file: how a diff shows it',
};

/** Sources that reach the window's storage themselves, and why. */
const STORAGE_READERS: Record<string, string> = {
  'components/fileListViewStore.ts': 'starts from the layout Changes kept before every file list shared one',
  'app/settings/windowKeptSettings.ts': 'hands what the storage kept before the settings held it to them, then forgets it',
  'features/branchExplorer/branchExplorerStore.ts': 'puts aside what version 2 kept per repository, for the settings',
};

const sources = filesUnder(__dirname, isAppSource)
  .map((file) => ({ file: relative(__dirname, file).split(sep).join('/'), text: readFileSync(file, 'utf8') }))
  // The tests' fakes give the window a storage (`fakeWindow`): they keep nothing.
  .filter(({ file }) => !file.startsWith('testing/'));
const stored = sources.filter(({ text }) => /\bpersist\(/.test(text));

/** A source without its comments, which may name the storage without reaching it. */
const codeOf = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe("a window's storage", () => {
  it('holds only stores named as layout, each with why', () => {
    expect(stored.map(({ file }) => file).sort()).toEqual(Object.keys(LAYOUT_STORES).sort());
  });

  it('keeps no map of repositories, workspaces or servers, which the settings keep (`RepositorySettings`)', () => {
    const byPlace = stored.filter(({ text }) => /\w+By(Repository|Workspace|Server|Place)\b|\bRepositorySettings\b/.test(text)).map(({ file }) => file);
    expect(byPlace).toEqual([]);
  });

  it('keeps only the maps named, each keyed by something of the window, not a place', () => {
    const maps = stored.flatMap(({ file, text }) => [...text.matchAll(/^\s+(\w+)\??: (?:Readonly<)?Record</gm)].map(([, field]) => `${file}#${field}`));
    expect(maps.sort()).toEqual(Object.keys(KEYED_MAPS).sort());
  });

  it('is reached directly only by the sources named, each with why', () => {
    const readers = sources.filter(({ text }) => /\b(localStorage|sessionStorage)\b/.test(codeOf(text))).map(({ file }) => file);
    expect(readers.sort()).toEqual(Object.keys(STORAGE_READERS).sort());
  });
});
