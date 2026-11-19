import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

const sources = filesUnder(__dirname, isAppSource).map((file) => ({ file: relative(__dirname, file), text: readFileSync(file, 'utf8') }));

/** Each `<SplitPane …>`'s props, up to the panes it splits. */
const splitPanesIn = (text: string): string[] => [...text.matchAll(/<SplitPane\b([\s\S]*?)\bfirst=/g)].map(([, props]) => props!);

/** A source's string constants, by name: its own first, as two files may each name theirs alike (`DETAILS_KEY`). */
const constantsIn = (text: string): Map<string, string> => new Map([...text.matchAll(/^(?:export )?const (\w+) = '([^']+)';/gm)].map(([, name, value]) => [name!, value!]));
const allConstants = new Map(sources.flatMap(({ text }) => [...constantsIn(text)]));

/** The keys a source gives a prop (`detailsKey`, `widthKey`): a string, or a constant; a prop handed on names none. */
function keysGiven(text: string, prop: string): string[] {
  const own = constantsIn(text);
  return [...text.matchAll(new RegExp(`\\b${prop}=(?:"([^"]+)"|\\{(\\w+)\\})`, 'g'))]
    .filter(([, , name]) => name !== prop)
    .map(([given, literal, name]) => literal ?? own.get(name!) ?? allConstants.get(name!) ?? `unreadable: ${given}`);
}

/** The widths' keys: what's given to `RememberedSplitPane`, and the constants named for a width (`*WIDTH_KEY`). */
const widthKeys = [
  ...new Set(sources.flatMap(({ text }) => [...keysGiven(text, 'widthKey'), ...[...text.matchAll(/^(?:export )?const \w*WIDTH_KEY = '([^']+)';/gm)].map(([, key]) => key!)])),
].sort();
const detailsKeys = [...new Set(sources.flatMap(({ text }) => keysGiven(text, 'detailsKey')))].sort();

/**
 * A splitter dragged opens where it was left, across pages and sessions: the panes are sized as the user reads them
 * (`RememberedSplitPane`, `ListWithDetails`, the command log's height). Every width is kept in one store
 * (`useDetailsPaneStore`), so each needs a key no other splitter or details panel uses.
 */
describe('splitters', () => {
  it('each remember where they were dragged', () => {
    const forgetting = sources.flatMap(({ file, text }) => splitPanesIn(text).filter((props) => !/\bsize=\{/.test(props) || !/\bonSizeChange=\{/.test(props)).map(() => file));
    expect(forgetting).toEqual([]);
  });

  it('each remember theirs under a key of their own', () => {
    expect(widthKeys).toEqual(expect.arrayContaining(['diffFiles', 'dialogDiffFiles', 'historyList', 'incomingList', 'mergeList', 'pendingChangesList']));
    expect(widthKeys.filter((key) => key.startsWith('unreadable'))).toEqual([]);
    expect(widthKeys.filter((key) => detailsKeys.includes(key))).toEqual([]);
  });
});
