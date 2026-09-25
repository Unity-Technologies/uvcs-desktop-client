import { describe, expect, it } from 'vitest';
import { captionAlpha, detailLevel } from './drawContext';

describe('captionAlpha', () => {
  it('shows the comments fully when zoomed in and hides them zoomed out', () => {
    expect(captionAlpha(1)).toBe(1);
    expect(captionAlpha(0.8)).toBe(1);
    expect(captionAlpha(0.6)).toBe(0);
  });

  it('fades them in between instead of popping', () => {
    const halfway = captionAlpha(0.725);
    expect(halfway).toBeGreaterThan(0.3);
    expect(halfway).toBeLessThan(0.7);
  });
});

describe('detailLevel', () => {
  it('hides the comments when the user turned them off', () => {
    expect(detailLevel(1, { showComments: false, showAvatars: true }).captions).toBe(0);
    expect(detailLevel(1, { showComments: true, showAvatars: true }).captions).toBe(1);
  });
});
