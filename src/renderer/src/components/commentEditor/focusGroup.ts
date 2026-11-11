import type { FieldSelection } from './commentFieldProps';

/** A field of a comment written in two parts: the check-in's summary (its title) and description. */
export type GroupField = 'summary' | 'description';

/**
 * The fields focus mode opens together (docs/features/rich-comments.md, "Writing"): the check-in's summary over its
 * description, to edit the title while writing the body; every other comment (a dialog's) alone.
 */
export function focusModeFields(surface: 'checkin' | 'single'): readonly GroupField[] {
  return surface === 'checkin' ? ['summary', 'description'] : ['description'];
}

export type GroupKey = 'Tab' | 'ShiftTab' | 'ArrowDown' | 'ArrowUp';

/**
 * Where a key takes the caret between a group's fields while focus mode shows them: Tab, or ↓ at its end, from the
 * summary to the description's start; ↑ on its first line from the description to the summary's end. ⇧Tab in the
 * description outdents (`outdentLines`): the text has Tab there. Null leaves the key its usual work.
 */
export function groupMove(field: GroupField, key: GroupKey, at: { atEnd: boolean; onFirstLine: boolean }): { to: GroupField; caret: 'start' | 'end' } | null {
  if (field === 'summary' && (key === 'Tab' || (key === 'ArrowDown' && at.atEnd))) return { to: 'description', caret: 'start' };
  if (field === 'description' && key === 'ArrowUp' && at.onFirstLine) return { to: 'summary', caret: 'end' };
  return null;
}

/**
 * Whether the focus moving to `to` leaves the group's focus mode: anywhere outside its fields, or nowhere, except a
 * menu one of its fields opened (Recent comments), which renders apart from it, over the page.
 */
export function focusLeavesGroup(to: { inside: boolean; inMenu: boolean } | null): boolean {
  return !to || (!to.inside && !to.inMenu);
}

/** A caret past any text: brought within the text as it's placed (`withinText`), it's the text's end. */
const AT_TEXT_END: FieldSelection = { anchor: Number.MAX_SAFE_INTEGER, head: Number.MAX_SAFE_INTEGER };

/**
 * The caret a group's field takes once its panel moved (`CommentFocusGroup`, `panelParent`), its editor made anew: the
 * caret and selection it had, going in and coming back; opened with none in it (by its button), the text's end; closed
 * with none (the focus gone elsewhere), none, so the focus stays where it went.
 */
export function caretAfterMove(move: { opening: boolean; selection: FieldSelection | null }): FieldSelection | null {
  if (move.selection) return move.selection;
  return move.opening ? AT_TEXT_END : null;
}

/**
 * What the focus leaving one of the group's fields does to focus mode: closes it when the focus goes out of the group
 * (`focusLeavesGroup`); stays, into one of its fields or a menu they opened; going nowhere, looks again a frame later
 * (`nextFrame`), closing only if the focus isn't back in the group then. Nowhere is the window losing the focus (the
 * user switched apps: the larger editor waits for them) or an editor made anew as the panel moved, whose focus the new
 * one takes.
 */
export function blurOutcome(to: { inside: boolean; inMenu: boolean } | null): 'close' | 'stay' | 'nextFrame' {
  if (!to) return 'nextFrame';
  return focusLeavesGroup(to) ? 'close' : 'stay';
}
