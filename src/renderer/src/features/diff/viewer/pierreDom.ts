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

/**
 * Moves Pierre's gutter button slot (`data-gutter-utility-slot`, one for the whole diff) into a hovered line's number
 * cell. Pierre keeps it on the last picked line while lines are picked; the button of a line hovered outside the pick
 * goes on that line instead. Returns the slot, to find it again once Pierre took it out of the tree.
 */
export function moveGutterUtilityTo(numberCell: HTMLElement, knownSlot: Element | null): Element | null {
  const slot = (numberCell.getRootNode() as ParentNode).querySelector('[data-gutter-utility-slot]') ?? knownSlot;
  if (slot && slot.parentElement !== numberCell) numberCell.append(slot);
  return slot;
}

/**
 * Hovers what is under a still pointer anew, as if it had moved: Pierre only follows the pointer, so lines sliding
 * under it (after a discard) would stay unhovered. It's told the pointer left first, as the line it knew may be gone
 * or another.
 */
export function hoverUnderPointer(container: HTMLElement | null, at: { x: number; y: number } | null): void {
  const root = pierreShadowRoot(container);
  if (!root || !at) return;
  for (const pre of root.querySelectorAll('pre')) pre.dispatchEvent(new window.PointerEvent('pointerleave', { pointerType: 'mouse' }));
  root.elementFromPoint(at.x, at.y)?.dispatchEvent(new window.PointerEvent('pointermove', { pointerType: 'mouse', clientX: at.x, clientY: at.y, bubbles: true, composed: true }));
}
