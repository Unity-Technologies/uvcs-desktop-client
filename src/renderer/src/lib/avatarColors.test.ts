import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarColorOf } from './avatarColors';
import { STABLE_HUES } from './stableHue';

describe('avatarColorOf', () => {
  it('gives each name the fill of its stable hue, the same every time', () => {
    expect(AVATAR_COLORS).toHaveLength(STABLE_HUES.length);
    expect([avatarColorOf('a'), avatarColorOf('b'), avatarColorOf('ab')]).toEqual(['--avatar-red', '--avatar-rose', '--avatar-amber']);
    expect(avatarColorOf('ana.diaz@unity3d.com')).toBe(avatarColorOf('ana.diaz@unity3d.com'));
  });
});
