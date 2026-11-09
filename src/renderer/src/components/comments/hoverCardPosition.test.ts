import { describe, expect, it } from 'vitest';
import { hoverCardPosition } from './hoverCardPosition';

const window = { width: 820, height: 600 };
const card = { width: 300, height: 60 };

describe('hoverCardPosition', () => {
  it('opens over the chip, its start at the chip’s', () => {
    expect(hoverCardPosition({ left: 100, top: 300, right: 140, bottom: 318 }, card, window)).toEqual({ left: 100, top: 234 });
  });

  it('opens under the chip without room over it', () => {
    expect(hoverCardPosition({ left: 100, top: 30, right: 140, bottom: 48 }, card, window)).toEqual({ left: 100, top: 54 });
  });

  it('stays inside the window', () => {
    expect(hoverCardPosition({ left: 700, top: 300, right: 740, bottom: 318 }, card, window).left).toBe(512);
    expect(hoverCardPosition({ left: 2, top: 300, right: 40, bottom: 318 }, card, window).left).toBe(8);
  });
});
