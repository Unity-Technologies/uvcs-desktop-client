import { describe, expect, it, vi } from 'vitest';
import { listenForTooltips } from './tooltipEvents';

function wire() {
  const page = { document: new EventTarget(), window: new EventTarget() };
  const handlers = { move: vi.fn(), over: vi.fn(), hide: vi.fn() };
  const unwire = listenForTooltips(page, handlers);
  return { page, handlers, unwire };
}

describe('listenForTooltips', () => {
  // A menu trigger opens on pointerdown and cancels it, so no mousedown follows: the press itself has to hide the tooltip.
  it('hides the tooltip on a press, before a menu trigger can open and swallow the mousedown', () => {
    const { page, handlers } = wire();
    page.document.dispatchEvent(new Event('pointerdown'));
    expect(handlers.hide).toHaveBeenCalledTimes(1);
  });

  it('hides it when a key opens a menu from the keyboard, on scroll and when the window loses focus', () => {
    const { page, handlers } = wire();
    page.document.dispatchEvent(new Event('keydown'));
    page.window.dispatchEvent(new Event('scroll'));
    page.window.dispatchEvent(new Event('blur'));
    expect(handlers.hide).toHaveBeenCalledTimes(3);
  });

  it('follows the pointer and what it hovers, until unwired', () => {
    const { page, handlers, unwire } = wire();
    page.document.dispatchEvent(new Event('mousemove'));
    page.document.dispatchEvent(new Event('mouseover'));
    unwire();
    page.document.dispatchEvent(new Event('mouseover'));
    page.document.dispatchEvent(new Event('pointerdown'));
    expect(handlers.move).toHaveBeenCalledTimes(1);
    expect(handlers.over).toHaveBeenCalledTimes(1);
    expect(handlers.hide).not.toHaveBeenCalled();
  });
});
