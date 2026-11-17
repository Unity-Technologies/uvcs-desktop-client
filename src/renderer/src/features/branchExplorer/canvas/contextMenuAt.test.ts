import { describe, expect, it } from 'vitest';
import { clientPointOf } from './contextMenuAt';

describe('where a world point lies on the page', () => {
  it('follows the zoom and the pan, from the canvas\' corner', () => {
    expect(clientPointOf({ left: 200, top: 100 }, { zoom: 2, panX: -50, panY: 10 }, { x: 100, y: 58 })).toEqual({ x: 350, y: 226 });
  });
});
