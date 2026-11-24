import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/** The views laid out with `ObjectListView` (the component's own file aside). */
const listViews = filesUnder(__dirname, isAppSource)
  .filter((file) => basename(file) !== 'ObjectListView.tsx')
  .map((file) => ({ name: basename(file), source: readFileSync(file, 'utf8') }))
  .filter(({ source }) => /<ObjectListView\b/.test(source));

/** Every list view refreshes the same way: a `ViewRefreshButton` in its header, beside what ⌘R does. */
describe('list views', () => {
  it('each have the Refresh button in their header', () => {
    expect(listViews.map(({ name }) => name)).toEqual(expect.arrayContaining(['BranchesView.tsx', 'ChangesetsView.tsx']));
    const withoutRefresh = listViews.filter(({ source }) => !/<ViewRefreshButton\b/.test(source)).map(({ name }) => name);
    expect(withoutRefresh).toEqual([]);
  });
});
