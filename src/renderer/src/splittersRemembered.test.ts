import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

const sources = filesUnder(__dirname, isAppSource).map((file) => ({ file: relative(__dirname, file), text: readFileSync(file, 'utf8') }));

/** Each `<SplitPane …>`'s props, up to the panes it splits. */
const splitPanesIn = (text: string): string[] => [...text.matchAll(/<SplitPane\b([\s\S]*?)\bfirst=/g)].map(([, props]) => props!);

/**
 * A splitter dragged opens where it was left, across pages and sessions: the panes are sized as the user reads them
 * (`RememberedSplitPane`, `ListWithDetails`, the command log's height).
 */
describe('splitters', () => {
  it('each remember where they were dragged', () => {
    const forgetting = sources.flatMap(({ file, text }) => splitPanesIn(text).filter((props) => !/\bsize=\{/.test(props)).map(() => file));
    expect(forgetting).toEqual([]);
  });

  it('each remember theirs under a key of their own', () => {
    const keys = sources.flatMap(({ text }) => [...text.matchAll(/^(?:export )?const \w*WIDTH_KEY = '([^']+)';/gm)].map(([, key]) => key!));
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toEqual([...new Set(keys)]);
  });
});
