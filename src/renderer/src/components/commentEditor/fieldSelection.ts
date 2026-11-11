import type { FieldSelection } from './commentFieldProps';

/** A caret or selection kept from a field (`CommentFieldHandle.selection`), within a text `length` long now. */
export function withinText(selection: FieldSelection, length: number): FieldSelection {
  const clamp = (offset: number): number => Math.max(0, Math.min(offset, length));
  return { anchor: clamp(selection.anchor), head: clamp(selection.head) };
}
