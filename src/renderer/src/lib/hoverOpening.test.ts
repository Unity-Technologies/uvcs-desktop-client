import { describe, expect, it } from 'vitest';
import { HOVER_CLOSE_DELAY_MS, HOVER_OPEN_DELAY_MS, hoverStep } from './hoverOpening';

const TOOLTIP_LIKE = { scrollable: false, overCard: false };
const SCROLLABLE = { scrollable: true, overCard: false };
const SCROLLABLE_UNDER_POINTER = { scrollable: true, overCard: true };

describe('hoverStep', () => {
  it('opens after the pointer rests on the anchor, at once on keyboard focus', () => {
    expect(hoverStep('enterAnchor', TOOLTIP_LIKE)).toEqual({ open: true, afterMs: HOVER_OPEN_DELAY_MS });
    expect(hoverStep('focus', TOOLTIP_LIKE)).toEqual({ open: true, afterMs: 0 });
  });

  it('closes a card the pointer passes through as soon as it leaves the anchor or the focus goes', () => {
    expect(hoverStep('leaveAnchor', TOOLTIP_LIKE)).toEqual({ open: false, afterMs: 0 });
    expect(hoverStep('blur', TOOLTIP_LIKE)).toEqual({ open: false, afterMs: 0 });
  });

  it('gives the pointer time to cross onto a card that scrolls, and keeps it while the pointer rests there', () => {
    expect(hoverStep('leaveAnchor', SCROLLABLE)).toEqual({ open: false, afterMs: HOVER_CLOSE_DELAY_MS });
    expect(hoverStep('enterCard', SCROLLABLE)).toEqual({ keep: true });
    expect(hoverStep('leaveCard', SCROLLABLE)).toEqual({ open: false, afterMs: HOVER_CLOSE_DELAY_MS });
  });

  it('keeps a card that scrolls open when a press in it takes the anchor’s focus, to select its text', () => {
    expect(hoverStep('blur', SCROLLABLE_UNDER_POINTER)).toEqual({ keep: true });
    expect(hoverStep('blur', SCROLLABLE)).toEqual({ open: false, afterMs: 0 });
  });
});
