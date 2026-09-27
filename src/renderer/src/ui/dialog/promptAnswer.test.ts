import { describe, expect, it } from 'vitest';
import { promptAnswer } from './promptAnswer';

describe('promptAnswer', () => {
  it('answers with the new text, without its surrounding spaces', () => {
    expect(promptAnswer('  game-2 ', 'game')).toBe('game-2');
  });

  it("doesn't answer while the text is blank", () => {
    expect(promptAnswer('   ', 'game')).toBeUndefined();
  });

  it("doesn't answer with the text it started with, so Enter can't rename to the same name", () => {
    expect(promptAnswer('game', 'game')).toBeUndefined();
    expect(promptAnswer(' game ', 'game')).toBeUndefined();
  });
});
