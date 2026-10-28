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
