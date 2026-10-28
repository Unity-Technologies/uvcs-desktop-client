import { StateEffect, StateField, type EditorState, type Extension, type TransactionSpec } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

/**
 * The editor's focus (docs/features/rich-comments.md, "Suggestions"). The truth is the DOM's (`view.hasFocus`);
 * `hasFocus` is only its mirror in the state, for what sees no view: the decorations drawn as the text reads around
 * the caret, the table field (block widgets come from a state field), the keys. What runs in React with the view in
 * hand (the suggestions, the selection bar, the toolbar) asks `editorFocused`, the DOM's, so a mirror behind can never
 * hide them.
 *
 * The mirror is kept by CodeMirror's focus notification and reconciled whenever the two may differ
 * (`focusReconciler`): on `focusin` and `focusout`, and after any update where they do. A focus CodeMirror's
 * notification never told: focus mode opened by its button on a field that wasn't focused moves the field and gives
 * it the focus in code, and the mirror stayed false while the DOM had the focus; a later click inside the box brought
 * no focus event either. Before, the mirror was set once, at mount (`noteFocus`), and nothing put it right.
 */
const focusChanged = StateEffect.define<boolean>();

export const hasFocus = StateField.define<boolean>({
  create: () => false,
  update: (focused, transaction) => transaction.effects.reduce((value, effect) => (effect.is(focusChanged) ? effect.value : value), focused),
});

/** The transaction that sets the mirror to the DOM's focus, or null when they agree. */
export function focusMirrorSpec(state: EditorState, domFocused: boolean): TransactionSpec | null {
  return state.field(hasFocus, false) === domFocused ? null : { effects: focusChanged.of(domFocused) };
}

/** Whether a field has the focus: the DOM's once its view exists (`viewHasFocus`), the mirror before. */
export function editorFocused(viewHasFocus: boolean | null, mirrored: boolean): boolean {
  return viewHasFocus ?? mirrored;
}

/** Whether the field shows as focused: the DOM's focus once its view exists, the state's mirror before it. */
export function fieldFocused(view: EditorView | null, state: EditorState): boolean {
  return editorFocused(view ? view.hasFocus : null, state.field(hasFocus));
}

/** Sets the mirror to the DOM's focus, when they differ. */
export function reconcileFocus(view: EditorView): void {
  const spec = focusMirrorSpec(view.state, view.hasFocus);
  if (spec) view.dispatch(spec);
}

/** Gives the editor the focus in code, and its mirror with it: every place code focuses an editor goes through it. */
export function focusEditor(view: EditorView): void {
  view.focus();
  reconcileFocus(view);
}

/**
 * Keeps the mirror on the DOM's focus: on `focusin` and `focusout`, and after an update that leaves them apart, each
 * outside the update it follows (a microtask), never re-entrantly.
 */
const focusReconciler = ViewPlugin.define((view) => {
  let queued = false;
  let destroyed = false;
  const reconcileSoon = (): void => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!destroyed) reconcileFocus(view);
    });
  };
  view.dom.addEventListener('focusin', reconcileSoon);
  view.dom.addEventListener('focusout', reconcileSoon);
  return {
    update: (update) => {
      if (update.view.hasFocus !== update.state.field(hasFocus)) reconcileSoon();
    },
    destroy: () => {
      destroyed = true;
      view.dom.removeEventListener('focusin', reconcileSoon);
      view.dom.removeEventListener('focusout', reconcileSoon);
    },
  };
});

/** The focus's mirror and what keeps it right. */
export function editorFocus(): Extension {
  return [hasFocus, EditorView.focusChangeEffect.of((_state, focusing) => focusChanged.of(focusing)), focusReconciler];
}
