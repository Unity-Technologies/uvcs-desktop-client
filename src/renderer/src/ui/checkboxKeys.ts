/**
 * Whether a key pressed on a checkbox submits its form, as on a native checkbox: Enter submits (a dialog's
 * primary action), Space toggles. Buttons click on both, so the checkbox, a button, has to tell them apart.
 */
export function submitsForm(key: string): boolean {
  return key === 'Enter';
}
