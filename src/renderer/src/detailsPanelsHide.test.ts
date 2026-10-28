import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

const sources = filesUnder(__dirname, isAppSource).map((file) => readFileSync(file, 'utf8'));

/** Every string constant of the app, by name: a key may be given by a constant another file exports. */
const constants = new Map(sources.flatMap((source) => [...source.matchAll(/^(?:export )?const (\w+) = '([^']+)';/gm)].map(([, name, value]) => [name!, value!] as const)));

/**
 * The keys given as `detailsKey` in a source, to the toggle in a header (`detailsToggle={<DetailsToggleButton …`) or
 * to the rest (`ListWithDetails` and what lays a view out with it: `ObjectListView`, `RepositoryTree`...): a string,
 * or a constant. A component handing on its own `detailsKey` prop names no key: whoever renders it does.
 */
function detailsKeysGiven(source: string, toToggle: boolean): string[] {
  return [...source.matchAll(/(detailsToggle=\{<DetailsToggleButton\s+)?\bdetailsKey=(?:"([^"]+)"|\{(\w+)\})/g)]
    .filter(([, toggle]) => Boolean(toggle) === toToggle)
    .filter(([, , , name]) => name !== 'detailsKey')
    .map(([given, , literal, name]) => literal ?? constants.get(name!) ?? `unreadable: ${given}`);
}

const keysGiven = (toToggle: boolean): string[] => [...new Set(sources.flatMap((source) => detailsKeysGiven(source, toToggle)))].sort();

/** Every view and page with a details panel hides it the same way: a `DetailsToggleButton` in its header. */
describe('details panels', () => {
  it('each have the toggle that hides them in their header, under the same key', () => {
    const panels = keysGiven(false);
    expect(panels).toEqual(expect.arrayContaining(['branchExplorer', 'branches', 'filesTree']));
    expect(keysGiven(true)).toEqual(panels);
  });
});
