import { describe, expect, it } from 'vitest';
import { returnsToFieldAfterPick } from './focusAfterPick';

describe('returnsToFieldAfterPick', () => {
  it('puts the caret back in the comment after a click picks, so typing goes on where it was', () => {
    expect(returnsToFieldAfterPick('pointer')).toBe(true);
  });

  it('keeps the focus on the switch while keys pick, so ← and → go on through the choices', () => {
    expect(returnsToFieldAfterPick('keys')).toBe(false);
  });
});
