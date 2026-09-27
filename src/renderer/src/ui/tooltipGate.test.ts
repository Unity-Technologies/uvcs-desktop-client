import { describe, expect, it } from 'vitest';
import { TooltipGate } from './tooltipGate';

describe('TooltipGate', () => {
  it('shows tooltips on hover to begin with', () => {
    expect(new TooltipGate().allowsHover).toBe(true);
  });

  it('keeps them away after a key press while the pointer stays where it was, as a keyboard switch re-renders the pill under it', () => {
    const gate = new TooltipGate();
    gate.pointerAt(300, 20);
    gate.keyPressed();
    gate.pointerAt(300, 20);
    expect(gate.allowsHover).toBe(false);
  });

  it('lets them show again once the pointer moves', () => {
    const gate = new TooltipGate();
    gate.pointerAt(300, 20);
    gate.keyPressed();
    gate.pointerAt(310, 22);
    expect(gate.allowsHover).toBe(true);
  });
});
