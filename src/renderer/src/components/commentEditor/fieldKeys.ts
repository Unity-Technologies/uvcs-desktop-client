/**
 * What ⌘↵ and Enter do in a comment field, the one decision both the editor and the plain field before it take
 * (`commentEditorSetup`, `CommentField`).
 *
 * - `owner`: the field's own handler (`onSubmit`, `onEnter`);
 * - `form`: the form it sits in is submitted (a dialog), as an input's Enter submits it;
 * - `window`: the key goes on to the window's shortcut (⌘↵ checks in, merges);
 * - `newLine`: Enter writes a line end (a field of many lines);
 * - `nothing`: the key is taken and does nothing (Enter on one line with no form).
 */
export type FieldKeyAction = 'owner' | 'form' | 'window' | 'newLine' | 'nothing';

export interface FieldKeyContext {
  singleLine: boolean;
  /** The field's `onSubmit` for ⌘↵, or its `onEnter` for Enter. */
  hasHandler: boolean;
  /** Whether it sits in a form (a dialog). */
  inForm: boolean;
}

export function modEnterAction({ hasHandler, inForm }: FieldKeyContext): FieldKeyAction {
  return hasHandler ? 'owner' : inForm ? 'form' : 'window';
}

export function enterAction({ singleLine, hasHandler, inForm }: FieldKeyContext): FieldKeyAction {
  if (!singleLine) return 'newLine';
  return hasHandler ? 'owner' : inForm ? 'form' : 'nothing';
}
