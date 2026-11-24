import { describe, expect, it, vi } from 'vitest';
import { stopOnUserScroll } from './userScrollStop';

describe('stopOnUserScroll', () => {
  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])('stops at the user moving the view themselves (%s)', (type) => {
    const element = new EventTarget();
    const stop = vi.fn();
    stopOnUserScroll(element, stop);
    element.dispatchEvent(new Event(type));
    expect(stop).toHaveBeenCalledOnce();
  });

  it('stops once, however much the user goes on', () => {
    const element = new EventTarget();
    const stop = vi.fn();
    stopOnUserScroll(element, stop);
    element.dispatchEvent(new Event('wheel'));
    element.dispatchEvent(new Event('wheel'));
    expect(stop).toHaveBeenCalledOnce();
  });

  // Scrolls, Pierre's own among them, aren't the user's doing: only what the user does stops it.
  it("goes on through scrolls and once it's no longer listening", () => {
    const element = new EventTarget();
    const stop = vi.fn();
    const stopListening = stopOnUserScroll(element, stop);
    element.dispatchEvent(new Event('scroll'));
    stopListening();
    element.dispatchEvent(new Event('wheel'));
    expect(stop).not.toHaveBeenCalled();
  });
});
