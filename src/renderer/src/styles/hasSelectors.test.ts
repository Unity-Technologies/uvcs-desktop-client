/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder } from '@shared/testing/filesUnder';

const RENDERER = join(__dirname, '..');

/** A `:has(…)` followed by `*` (after a space or a combinator): the rule's subject is every element under it. */
const HAS_THEN_EVERYTHING = /:has\((?:[^()]|\([^()]*\))*\)\s*[>~+]?\s*\*/;

function selectorsRestylingEverything(css: string): string[] {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((rule) => rule.split('{')[0]!.trim())
    .filter((selector) => HAS_THEN_EVERYTHING.test(selector));
}

describe('`:has()` rules', () => {
  // Chromium re-checks such a rule on every DOM change inside the element, and restyles all of its subject when it may
  // have changed: with `*` under the document, a row added to a list restyled the whole page (7 ms per command logged).
  it('never restyle every element under them', () => {
    const offending = filesUnder(RENDERER, (name) => name.endsWith('.css')).flatMap((path) =>
      selectorsRestylingEverything(readFileSync(path, 'utf8')).map((selector) => `${path.slice(RENDERER.length + 1)}: ${selector}`),
    );
    expect(offending).toEqual([]);
  });

  it('tells such a rule from a narrow one', () => {
    expect(selectorsRestylingEverything("html:has([role='dialog']) * { color: red; }")).toHaveLength(1);
    expect(selectorsRestylingEverything('.list:has(> .row) > * { color: red; }')).toHaveLength(1);
    expect(selectorsRestylingEverything("html:has([role='dialog']) .titleBar { color: red; }")).toEqual([]);
    expect(selectorsRestylingEverything('.row:has(.name:focus-visible) { color: red; }')).toEqual([]);
  });
});
