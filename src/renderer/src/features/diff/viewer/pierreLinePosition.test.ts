import { VirtualizedFileDiff, Virtualizer } from '@pierre/diffs';
import { describe, expect, it, vi } from 'vitest';
import { pierreLinePosition, type VirtualizerInternals } from './pierreLinePosition';

describe('pierreLinePosition', () => {
  it("reaches the diff a virtualizer holds by its container, and the diff's line positions", () => {
    // Connecting queues a render for the next frame.
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const virtualizer = new Virtualizer();
    // Connected as `setup` leaves it, without the DOM's observers.
    Object.assign(virtualizer, { intersectionObserver: { observe: () => undefined, unobserve: () => undefined } });
    const container = {} as Element;
    const diff = { top: 100, getLinePosition: (lineNumber: number) => ({ top: lineNumber * 20, height: 20 }) };
    virtualizer.connect(container as HTMLElement, diff as never);

    expect((virtualizer as unknown as VirtualizerInternals).observers.get(container)).toBe(diff);
    expect(pierreLinePosition(virtualizer, container, { side: 'additions', lineNumber: 3 })).toBe(160);
    expect(pierreLinePosition(virtualizer, {} as Element, { side: 'additions', lineNumber: 3 })).toBeUndefined();
    expect(typeof VirtualizedFileDiff.prototype.getLinePosition).toBe('function');
    vi.unstubAllGlobals();
  });
});
