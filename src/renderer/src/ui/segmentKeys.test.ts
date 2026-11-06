import { describe, expect, it } from 'vitest';
import { segmentAfterKey, segmentTabStop } from './segmentKeys';

describe('segmentAfterKey', () => {
  const values = ['mine', 'everyone', 'recent'];

  it('steps with ← and →, wrapping around', () => {
    expect(segmentAfterKey(values, 'mine', 'ArrowRight')).toBe('everyone');
    expect(segmentAfterKey(values, 'recent', 'ArrowRight')).toBe('mine');
    expect(segmentAfterKey(values, 'mine', 'ArrowLeft')).toBe('recent');
  });

  it('leaves other keys, ↑ and ↓ included, to the control around it', () => {
    expect(segmentAfterKey(values, 'mine', 'ArrowDown')).toBeNull();
    expect(segmentAfterKey(values, 'mine', 'Enter')).toBeNull();
  });
});

describe('segmentTabStop', () => {
  const values = ['both', 'destination', 'source'];

  it('is the checked segment', () => {
    expect(segmentTabStop(values, 'source')).toBe('source');
  });

  it('is the first while none is checked, so the group keeps its Tab stop', () => {
    expect(segmentTabStop(values, null)).toBe('both');
    expect(segmentTabStop(values, 'other')).toBe('both');
  });
});
