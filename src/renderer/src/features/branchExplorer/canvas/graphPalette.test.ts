import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarColorOf } from '../../../lib/avatarColors';
import { avatarFill, branchColor, branchInk, withBranchColors, type GraphPalette } from './graphPalette';

/** The avatar fills as a theme resolves its `--avatar-*` tokens: here each one's own name, to tell them apart. */
const avatars = Object.fromEntries(AVATAR_COLORS.map((token) => [token, `resolved ${token}`])) as GraphPalette['avatars'];

describe('avatarFill', () => {
  it('paints an author’s avatar in the fill every other avatar of theirs has (`avatarColorOf`), as the theme resolves it', () => {
    for (const owner of ['ana@example.com', 'bob', 'dev17@example.com']) {
      expect(avatarFill({ avatars } as GraphPalette, owner)).toBe(`resolved ${avatarColorOf(owner)}`);
    }
  });
});

describe('withBranchColors', () => {
  const palette = { isDark: false, accent: 'accent', accentText: 'accent text', branchHues: true } as GraphPalette;

  it('paints every branch in the accent when branch colors are off, /main included', () => {
    const plain = withBranchColors(palette, false);
    for (const name of ['/main', '/main/task-12', '/main/feature/ui']) {
      expect(branchColor(plain, name)).toBe('accent');
      expect(branchInk(plain, name)).toBe('accent text');
    }
  });

  it('keeps each branch’s own hue when they are on', () => {
    expect(withBranchColors(palette, true)).toBe(palette);
    expect(branchColor(palette, '/main/task-12')).not.toBe('accent');
  });

  it('hands back the same palette each frame, so the colors it remembers are kept', () => {
    expect(withBranchColors(palette, false)).toBe(withBranchColors(palette, false));
  });
});
