import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/**
 * DOM calls that return a promise in the Chromium the app runs: `scrollIntoView` does now. An effect whose arrow
 * returns one hands React a "clean-up" that isn't a function, and the window crashes when the effect runs again
 * ("destroy is not a function").
 */
const PROMISE_RETURNING_DOM_CALLS = ['scrollIntoView'];

describe('effects', () => {
  it('never return what a promise-returning DOM call gives: a block body around the call', () => {
    const returning = new RegExp(`use(?:Layout)?Effect\\(\\(\\) => [^{][^\\n]*\\.(?:${PROMISE_RETURNING_DOM_CALLS.join('|')})\\(`);
    const offenders = filesUnder(__dirname, isAppSource)
      .filter((file) => returning.test(readFileSync(file, 'utf8')))
      .map((file) => relative(__dirname, file));
    expect(offenders).toEqual([]);
  });
});
