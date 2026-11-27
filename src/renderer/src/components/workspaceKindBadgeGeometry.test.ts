import { describe, expect, it } from 'vitest';
import { BADGE_DISC, BADGE_GLYPH, BADGE_VIEW_BOX } from './workspaceKindBadgeGeometry';

describe('the workspace kind badge geometry', () => {
  it('centers the glyph on the disc, on both axes', () => {
    expect(BADGE_GLYPH.x + BADGE_GLYPH.size / 2).toBe(BADGE_DISC.center);
    expect(BADGE_GLYPH.y + BADGE_GLYPH.size / 2).toBe(BADGE_DISC.center);
  });

  it('centers the disc in the badge, its rim inside the edge', () => {
    expect(BADGE_DISC.center).toBe(BADGE_VIEW_BOX / 2);
    expect(BADGE_DISC.radius + BADGE_DISC.rim / 2).toBeLessThanOrEqual(BADGE_VIEW_BOX / 2);
  });

  it('keeps the glyph inside the rim', () => {
    expect(BADGE_GLYPH.x).toBeGreaterThanOrEqual(BADGE_DISC.center - BADGE_DISC.radius + BADGE_DISC.rim / 2);
  });
});
