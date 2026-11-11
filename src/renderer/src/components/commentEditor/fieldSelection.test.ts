import { describe, expect, it } from 'vitest';
import { withinText } from './fieldSelection';

describe('withinText', () => {
  it('keeps a caret or a selection, its direction too, where the text still has it', () => {
    expect(withinText({ anchor: 4, head: 4 }, 10)).toEqual({ anchor: 4, head: 4 });
    expect(withinText({ anchor: 8, head: 2 }, 10)).toEqual({ anchor: 8, head: 2 });
  });

  it('brings it within a text that got shorter meanwhile', () => {
    expect(withinText({ anchor: 3, head: 12 }, 5)).toEqual({ anchor: 3, head: 5 });
  });
});
