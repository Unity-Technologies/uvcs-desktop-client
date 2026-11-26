import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Page } from './pages';

/**
 * Every kind of page, which the type checker holds to `Page`: a new kind doesn't compile here until it's added, and
 * then fails below until the smoke test opens it too.
 */
const PAGE_KINDS: Record<Page['kind'], true> = { history: true, diff: true, merge: true, codeReview: true, browseRepository: true };

/** The kinds the smoke test opens, each by a step that waits for it (`PAGES` and `pageShown` in scripts/e2e/smoke.mjs). */
function smokePages(): string[] {
  const smoke = readFileSync(resolve(__dirname, '../../../../../scripts/e2e/smoke.mjs'), 'utf8');
  const list = /^const PAGES = \[([^\]]*)\];/m.exec(smoke)?.[1];
  if (list === undefined) throw new Error('scripts/e2e/smoke.mjs has no `const PAGES = [...]`');
  return [...list.matchAll(/'(\w+)'/g)].map((match) => match[1]!);
}

describe('the smoke test', () => {
  it('opens every kind of page: a page no run reaches is a page whose wiring nothing checks', () => {
    expect(smokePages().sort()).toEqual(Object.keys(PAGE_KINDS).sort());
  });
});
