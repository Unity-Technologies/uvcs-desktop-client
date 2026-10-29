import { describe, expect, it } from 'vitest';
import { backdropParent } from './backdropParent';

describe('backdropParent', () => {
  it('puts the larger editor’s backdrop in the dialog it opened from: a click on it is no click outside the dialog', () => {
    const dialog = { role: 'dialog' } as unknown as Element;
    const field = { closest: (selector: string) => (selector === '[role="dialog"]' ? dialog : null) } as unknown as Element;
    expect(backdropParent(field)).toBe(dialog);
  });
});
