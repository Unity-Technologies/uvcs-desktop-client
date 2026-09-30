import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarColorOf } from '../../../lib/avatarColors';
import { avatarFill, type GraphPalette } from './graphPalette';

/** The avatar fills as a theme resolves its `--avatar-*` tokens: here each one's own name, to tell them apart. */
const avatars = Object.fromEntries(AVATAR_COLORS.map((token) => [token, `resolved ${token}`])) as GraphPalette['avatars'];

describe('avatarFill', () => {
  it('paints an author’s avatar in the fill every other avatar of theirs has (`avatarColorOf`), as the theme resolves it', () => {
    for (const owner of ['ana@example.com', 'bob', 'dev17@example.com']) {
      expect(avatarFill({ avatars } as GraphPalette, owner)).toBe(`resolved ${avatarColorOf(owner)}`);
    }
  });
});
