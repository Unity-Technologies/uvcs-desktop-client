import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/** What shows a place's views and pages: a kept view, a page's frame, a page's content. */
const SHOWS_A_PLACE = /<(KeptView|PageFrame|PageContent)\b/;

const showing = filesUnder(__dirname, isAppSource)
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => ({ name: basename(file, '.tsx'), source: readFileSync(file, 'utf8') }))
  .filter(({ source }) => SHOWS_A_PLACE.test(source));

/**
 * Every window that shows a place's views or pages (a workspace's or repository's window, a page window) covers them
 * with the sign-in screen while the place's server needs a sign-in (`SignInCover`, docs/features/accounts.md): the
 * toasts of what its server refused are left to that screen (`toldBySignInScreen`), so a window without it would say
 * nothing at all.
 */
describe('places covered by the sign-in screen', () => {
  it('cover every view and page with SignInCover, in each window that shows them', () => {
    // A file another of them renders is inside that one's cover.
    const roots = showing.filter(({ name }) => !showing.some(({ source }) => new RegExp(`<${name}\\b`).test(source)));

    expect(roots.map(({ name }) => name).sort()).toEqual(['PageWindowScreen', 'PlaceLayout']);
    expect(roots.filter(({ source }) => !/<SignInCover\b/.test(source)).map(({ name }) => name)).toEqual([]);
  });
});
