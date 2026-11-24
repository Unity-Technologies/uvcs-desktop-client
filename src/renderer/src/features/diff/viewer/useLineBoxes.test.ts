import { describe, expect, it } from 'vitest';
import { renderedEdgeOf } from './useLineBoxes';

describe('renderedEdgeOf', () => {
  const rendered = { first: 120, last: 180 };

  it('puts a line not rendered above or below the lines that are', () => {
    expect(renderedEdgeOf(24, rendered)).toBe('above');
    expect(renderedEdgeOf(250, rendered)).toBe('below');
  });

  it('puts none within them (a line folded away), nor anywhere while nothing is rendered', () => {
    expect(renderedEdgeOf(150, rendered)).toBeNull();
    expect(renderedEdgeOf(24, null)).toBeNull();
  });
});
