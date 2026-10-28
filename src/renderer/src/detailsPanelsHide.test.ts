import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

const sources = filesUnder(__dirname, isAppSource).map((file) => readFileSync(file, 'utf8'));

/** The string constants a source defines, or only those it exports. */
const constantsIn = (source: string, exportedOnly: boolean) =>
  [...source.matchAll(exportedOnly ? /^export const (\w+) = '([^']+)';/gm : /^(?:export )?const (\w+) = '([^']+)';/gm)].map(([, name, value]) => [name!, value!] as const);

/** The string constants files export, by name: a key may be given by one; a name exported with two values reads as none. */
const exported = new Map<string, string | undefined>();
for (const [name, value] of sources.flatMap((source) => constantsIn(source, true))) {
  exported.set(name, exported.has(name) && exported.get(name) !== value ? undefined : value);
}

/**
 * The keys given as `detailsKey` in a source, to the toggle in a header (`detailsToggle={<DetailsToggleButton …`) or
 * to the rest (`ListWithDetails` and what lays a view out with it: `ObjectListView`, `RepositoryTree`...): a string,
 * or a constant of its own or exported. A component handing on its own `detailsKey` prop names no key: whoever
 * renders it does.
 */
function detailsKeysGiven(source: string, toToggle: boolean): string[] {
  // A file's own constant first: two files may each name theirs alike (`DETAILS_KEY`).
  const own = new Map(constantsIn(source, false));
  return [...source.matchAll(/(detailsToggle=\{<DetailsToggleButton\s+)?\bdetailsKey=(?:"([^"]+)"|\{(\w+)\})/g)]
    .filter(([, toggle]) => Boolean(toggle) === toToggle)
    .filter(([, , , name]) => name !== 'detailsKey')
    .map(([given, , literal, name]) => literal ?? own.get(name!) ?? exported.get(name!) ?? `unreadable: ${given}`);
}

const keysGiven = (toToggle: boolean): string[] => [...new Set(sources.flatMap((source) => detailsKeysGiven(source, toToggle)))].sort();

/** Every view and page with a details panel hides it the same way: a `DetailsToggleButton` in its header. */
describe('details panels', () => {
  it('each have the toggle that hides them in their header, under the same key', () => {
    const panels = keysGiven(false);
    expect(panels).toEqual(expect.arrayContaining(['branchExplorer', 'branches', 'browseRepositoryTree', 'filesTree', 'repositoryFilesTree']));
    expect(keysGiven(true)).toEqual(panels);
  });
});
