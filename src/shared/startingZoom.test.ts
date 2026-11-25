import { describe, expect, it } from 'vitest';
import { startingZoomIn, startingZoomQuery } from './startingZoom';

describe('startingZoomQuery and startingZoomIn', () => {
  it('reads back the zoom a window names in its page address', () => {
    const search = `?${new URLSearchParams({ workspace: '/wk', ...startingZoomQuery(1.2 ** -2) })}`;

    expect(startingZoomIn(search)).toBe(1.2 ** -2);
  });

  it('is 100% when the address names none, after the page forgot its query and reloaded, or one that is no zoom', () => {
    expect(startingZoomIn('')).toBe(1);
    expect(startingZoomIn('?zoom=')).toBe(1);
    expect(startingZoomIn('?zoom=abc')).toBe(1);
    expect(startingZoomIn('?zoom=0')).toBe(1);
    expect(startingZoomIn('?zoom=-2')).toBe(1);
  });
});
