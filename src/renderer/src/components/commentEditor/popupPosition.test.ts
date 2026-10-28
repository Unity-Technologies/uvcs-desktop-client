import { describe, expect, it } from 'vitest';
import { selectionBarPosition, suggestionListPosition } from './popupPosition';

describe('selectionBarPosition', () => {
  const bar = { width: 200, height: 30 };
  const window = { width: 820, height: 600 };

  it('centers the bar over the selection', () => {
    expect(selectionBarPosition({ left: 300, right: 400, top: 200, bottom: 218 }, bar, window)).toEqual({ left: 250, top: 164 });
  });

  it('puts it under the selection without room above', () => {
    expect(selectionBarPosition({ left: 300, right: 400, top: 20, bottom: 38 }, bar, window)).toEqual({ left: 250, top: 44 });
  });

  it('keeps it inside the window', () => {
    expect(selectionBarPosition({ left: 0, right: 20, top: 200, bottom: 218 }, bar, window).left).toBe(8);
    expect(selectionBarPosition({ left: 800, right: 818, top: 200, bottom: 218 }, bar, window).left).toBe(612);
  });
});

describe('suggestionListPosition', () => {
  const list = { width: 360, height: 200 };
  const window = { width: 820, height: 600 };

  it('opens the list under the line, at the trigger', () => {
    expect(suggestionListPosition({ left: 100, right: 120, top: 300, bottom: 318 }, list, window)).toEqual({ left: 100, top: 322 });
  });

  it('opens it over the line without room under it', () => {
    expect(suggestionListPosition({ left: 100, right: 120, top: 500, bottom: 518 }, list, window)).toEqual({ left: 100, top: 296 });
  });

  it('keeps it inside the window', () => {
    expect(suggestionListPosition({ left: 700, right: 720, top: 300, bottom: 318 }, list, window).left).toBe(452);
  });

  it('keeps it inside the window with the line at its bottom edge, or scrolled past it in a field taller than its box', () => {
    expect(suggestionListPosition({ left: 100, right: 120, top: 590, bottom: 608 }, list, window).top).toBe(386);
    expect(suggestionListPosition({ left: 100, right: 120, top: 900, bottom: 918 }, list, window).top).toBe(392);
  });

  it('goes over the line once the list grows past the room under it, the same rows taller', () => {
    const trigger = { left: 100, right: 120, top: 360, bottom: 378 };
    expect(suggestionListPosition(trigger, { width: 360, height: 30 }, window).top).toBe(382);
    expect(suggestionListPosition(trigger, { width: 360, height: 260 }, window).top).toBe(96);
  });
});
