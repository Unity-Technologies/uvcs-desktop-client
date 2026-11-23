import { describe, expect, it } from 'vitest';
import { focusFieldAfterPick } from './focusAfterPick';

function countedField(): { current: { focus: () => void }; focused: () => number } {
  let focused = 0;
  return { current: { focus: () => void focused++ }, focused: () => focused };
}

describe('focusFieldAfterPick', () => {
  it('puts the caret back in the comment after a click picks, so typing goes on where it was', () => {
    const field = countedField();
    focusFieldAfterPick(field, 'pointer');
    expect(field.focused()).toBe(1);
  });

  it('keeps the focus on the switch while keys pick, so ← and → go on through the choices', () => {
    const field = countedField();
    focusFieldAfterPick(field, 'keys');
    expect(field.focused()).toBe(0);
  });

  it('does nothing while the field is not there yet', () => {
    expect(() => focusFieldAfterPick({ current: null }, 'pointer')).not.toThrow();
  });
});
