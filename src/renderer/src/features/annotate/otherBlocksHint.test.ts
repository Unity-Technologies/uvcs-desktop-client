import { describe, expect, it } from 'vitest';
import { otherBlocksHint } from './otherBlocksHint';

describe('otherBlocksHint', () => {
  it('says nothing when the changeset has no other block', () => {
    expect(otherBlocksHint(0, true, 'alt+shift+down')).toEqual({ kind: 'none' });
  });

  it('asks to click the block while it is not picked', () => {
    expect(otherBlocksHint(3, false, 'alt+shift+down')).toEqual({ kind: 'click', text: 'Click the block to highlight its 3 other blocks' });
  });

  it('names the key to the next one once they are highlighted, and none when a person removed it', () => {
    expect(otherBlocksHint(1, true, 'alt+shift+down')).toEqual({ kind: 'highlighted', text: '1 other block highlighted', nextKey: 'alt+shift+down' });
    expect(otherBlocksHint(1, true, undefined)).toEqual({ kind: 'highlighted', text: '1 other block highlighted', nextKey: undefined });
  });
});
