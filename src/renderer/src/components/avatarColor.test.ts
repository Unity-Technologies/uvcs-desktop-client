import { describe, expect, it } from 'vitest';
import { STABLE_HUES, stableHue } from '../lib/stableHue';
import { AVATAR_COLORS } from '../lib/avatarColors';
import { avatarColor } from './avatarColor';

describe('avatarColor', () => {
  it("takes the repository's short name, so its workspaces and its own row share a color whatever the server", () => {
    const color = avatarColor('game', 'game');
    expect(avatarColor('game@acme@cloud', 'game-task-12')).toBe(color);
    expect(avatarColor('game@local', 'other')).toBe(color);
    expect(avatarColor('studio/game@acme@cloud', 'x')).toBe(color);
  });

  it("takes the workspace's own name while its repository isn't known", () => {
    expect(avatarColor(undefined, 'acme')).toBe(avatarColor('acme@acme@cloud', 'anything'));
    expect(avatarColor(null, 'acme')).toBe(avatarColor('acme', 'x'));
  });

  it('keeps the color family names always had: one fill per hue, in the hues order', () => {
    expect(AVATAR_COLORS).toHaveLength(STABLE_HUES.length);
    expect([stableHue('a'), stableHue('b'), stableHue('ab')]).toEqual([15, 355, 45]);
    expect([avatarColor('a@local', 'x'), avatarColor('b@local', 'x'), avatarColor(null, 'ab')]).toEqual(['--avatar-red', '--avatar-rose', '--avatar-amber']);
  });
});
