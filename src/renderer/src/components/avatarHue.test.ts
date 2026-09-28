import { describe, expect, it } from 'vitest';
import { stableHue } from '../lib/stableHue';
import { avatarHue } from './avatarHue';

describe('avatarHue', () => {
  it("takes the repository's short name, so its workspaces and its own row share a color whatever the server", () => {
    const hue = stableHue('game');
    expect(avatarHue('game@acme@cloud', 'game-task-12')).toBe(hue);
    expect(avatarHue('game@local', 'other')).toBe(hue);
    expect(avatarHue('studio/game@acme@cloud', 'x')).toBe(hue);
    expect(avatarHue('game', 'game')).toBe(hue);
  });

  it("takes the workspace's own name while its repository isn't known", () => {
    expect(avatarHue(undefined, 'codice')).toBe(stableHue('codice'));
    expect(avatarHue(null, 'codice')).toBe(avatarHue('codice@codice@cloud', 'anything'));
  });

  it('keeps the colors names always had', () => {
    expect([avatarHue('a@local', 'x'), avatarHue('b@local', 'x'), avatarHue(null, 'ab')]).toEqual([15, 355, 45]);
  });
});
