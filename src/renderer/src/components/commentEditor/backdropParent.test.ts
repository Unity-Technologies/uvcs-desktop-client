import { describe, expect, it } from 'vitest';
import { backdropParent, panelParent } from './backdropParent';

describe('backdropParent', () => {
  it('puts the larger editor’s backdrop in the dialog it opened from: a click on it is no click outside the dialog', () => {
    const dialog = { role: 'dialog' } as unknown as Element;
    const field = { closest: (selector: string) => (selector === '[role="dialog"]' ? dialog : null) } as unknown as Element;
    expect(backdropParent(field)).toBe(dialog);
  });
});

describe('panelParent', () => {
  const BODY = { tagName: 'BODY' } as unknown as Element;
  const fieldIn = (matches: Record<string, Element>) => ({ closest: (selector: string) => matches[selector] ?? null }) as unknown as Element;

  it("moves the larger editor out of a row slotted into a diff's code, which would hold it as a fixed panel's frame and clip it", () => {
    const dialog = { role: 'dialog' } as unknown as Element;
    expect(panelParent(fieldIn({ '[slot]': {} as Element }), BODY)).toBe(BODY);
    expect(panelParent(fieldIn({ '[slot]': {} as Element, '[role="dialog"]': dialog }), BODY)).toBe(dialog);
  });

  it('leaves it in place anywhere else: the panel lays out over the window from where it is', () => {
    expect(panelParent(fieldIn({}), BODY)).toBeNull();
    expect(panelParent(null, BODY)).toBeNull();
  });
});
