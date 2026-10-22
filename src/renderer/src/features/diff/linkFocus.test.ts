import { describe, expect, it } from 'vitest';
import { linkFocusOf, linkFocusOn } from './linkFocus';

const LINES = { side: 'new', first: 40, last: 52 } as const;

describe('linkFocusOf', () => {
  it('is the lines of the file the diff opens on, only with both', () => {
    expect(linkFocusOf('src/a.cs', LINES)).toEqual({ path: 'src/a.cs', lines: LINES });
    expect(linkFocusOf('src/a.cs', undefined)).toBeNull();
    expect(linkFocusOf(undefined, LINES)).toBeNull();
  });
});

describe('linkFocusOn', () => {
  const focus = linkFocusOf('src/a.cs', LINES);

  it("is on the link's file, by its path or the one it had before a move, named as the diff shows it", () => {
    expect(linkFocusOn(focus, { path: 'src/a.cs' })).toEqual({ path: 'src/a.cs', lines: LINES });
    expect(linkFocusOn(focus, { path: 'lib/a.cs', oldPath: 'src/a.cs' })).toEqual({ path: 'lib/a.cs', lines: LINES });
  });

  it('is on no other file, nor once the diff dropped it', () => {
    expect(linkFocusOn(focus, { path: 'src/b.cs' })).toBeNull();
    expect(linkFocusOn(focus, undefined)).toBeNull();
    expect(linkFocusOn(null, { path: 'src/a.cs' })).toBeNull();
  });
});
