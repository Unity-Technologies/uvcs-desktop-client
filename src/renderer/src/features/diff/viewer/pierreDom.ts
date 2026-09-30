import type { ChangedLine } from './changeBlocks';

/**
 * Where the viewer finds what Pierre renders. Pierre draws a diff (or a whole file) inside the shadow root of a
 * `diffs-container` element, one row per line in each column: a number cell (`data-column-number`) and a content row
 * (`data-line`), both with the line's type (`data-line-type`: `change-addition`, `change-deletion`, `context`...).
 * Everything the viewer styles, measures or hovers there goes through these, so a Pierre update that renames them is
 * fixed in one place.
 */

/** The shadow root of the diff inside `container` (the viewer's scrolling element); none before it renders. */
export function pierreShadowRoot(container: Element | null | undefined): ShadowRoot | null {
  return container?.querySelector('diffs-container')?.shadowRoot ?? null;
}

/** Whether the text of the diff inside `container` is being typed into: the caret is in Pierre's editor. */
export function isTypingIn(container: Element | null | undefined): boolean {
  const focused = pierreShadowRoot(container)?.activeElement;
  return focused instanceof HTMLElement && focused.isContentEditable;
}

/** The `data-line-type` of a changed line's rows. */
export function changedLineType({ side }: Pick<ChangedLine, 'side'>): 'change-addition' | 'change-deletion' {
  return side === 'deletions' ? 'change-deletion' : 'change-addition';
}

/** Selects a changed line's content row. */
export function lineRowSelector(line: ChangedLine): string {
  return `[data-line-type="${changedLineType(line)}"][data-line="${line.lineNumber}"]`;
}

/** Selects a changed line's number cell. */
export function numberCellSelector(line: ChangedLine): string {
  return `[data-line-type="${changedLineType(line)}"][data-column-number="${line.lineNumber}"]`;
}

