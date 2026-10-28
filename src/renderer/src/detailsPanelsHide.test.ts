import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

const sources = filesUnder(__dirname, isAppSource)
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => readFileSync(file, 'utf8'));

/**
 * The keys given as `detailsKey` in a source, to the toggle or to the rest (`ListWithDetails` and what lays a view out
 * with it: `ObjectListView`, `RepositoryTree`...): a string, or a constant of the file holding one.
 */
function detailsKeysGiven(source: string, toToggle: boolean): string[] {
  const constants = new Map([...source.matchAll(/^const (\w+) = '([^']+)';/gm)].map(([, name, value]) => [name!, value!]));
  return (
    [...source.matchAll(/(<DetailsToggleButton\s+)?\bdetailsKey=(?:"([^"]+)"|\{(\w+)\})/g)]
      .filter(([, toggle]) => Boolean(toggle) === toToggle)
      // A component handing on its own `detailsKey` prop names no key: whoever renders it does.
      .map(([, , literal, constant]) => literal ?? constants.get(constant!))
      .filter((key): key is string => key !== undefined)
  );
}

const keysGiven = (toToggle: boolean): string[] => [...new Set(sources.flatMap((source) => detailsKeysGiven(source, toToggle)))].sort();

/** Every view and page with a details panel hides it the same way: a `DetailsToggleButton` in its header. */
describe('details panels', () => {
  it('each have the toggle that hides them, under the same key', () => {
    const panels = keysGiven(false);
    expect(panels).toEqual(expect.arrayContaining(['branchExplorer', 'branches', 'filesTree']));
    expect(keysGiven(true)).toEqual(panels);
  });
});
