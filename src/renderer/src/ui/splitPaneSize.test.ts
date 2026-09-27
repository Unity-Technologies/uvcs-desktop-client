import { describe, expect, it } from 'vitest';
import { sizedPaneStyle } from './splitPaneSize';

describe('sizedPaneStyle', () => {
  it('keeps the size, leaving the other pane at least the minimum however narrow the split gets', () => {
    expect(sizedPaneStyle(true, 720, 300)).toEqual({ width: 720, maxWidth: 'calc(100% - 300px)' });
  });

  it('caps the height of a vertical split the same way', () => {
    expect(sizedPaneStyle(false, 900, 120)).toEqual({ height: 900, maxHeight: 'calc(100% - 120px)' });
  });
});
