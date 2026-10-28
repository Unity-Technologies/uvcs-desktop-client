import { StateEffect, StateField, type EditorState, type Extension, type TransactionSpec } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

/**
 * The editor's focus (docs/features/rich-comments.md, "Suggestions"). The truth is the DOM's (`view.hasFocus`);
 * `hasFocus` is only its mirror in the state, for what sees no view: the decorations drawn as the text reads around
 * the caret, the table field (block widgets come from a state field), the keys. What runs in React with the view in
 * hand (the suggestions, the selection bar, the toolbar) asks `editorFocused`, the DOM's, so a mirror behind can never
 * hide them.
 *
 * The mirror has one writer, the reconciler (`watchFocus`), which sets it whenever the two may differ: on the
 * field's and its window's focus events, and after any update where they do. A focus CodeMirror's
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

/** What the reconciler watches of a field: where its focus events land, the DOM's focus, its state, its dispatch. */
export interface WatchedFocus {
  /**
   * The field's DOM (`focusin`, `focusout`) and its window (`focus`, `blur`): the window's activation coming back moves
   * no element's focus, so the field itself hears nothing of it.
   */
  targets: readonly EventTarget[];
  hasFocus: () => boolean;
  state: () => EditorState;
  dispatch: (spec: TransactionSpec) => void;
}

const FOCUS_EVENTS = ['focusin', 'focusout', 'focus', 'blur'] as const;

/**
 * The mirror's only writer (`editorFocusRules.test.ts`): it sets the mirror to the DOM's focus on every focus event of
 * the field and its window, and after an update that left them apart, each outside the work it follows (`schedule`, a
 * microtask), never re-entrantly. CodeMirror's own focus notification (`focusChangeEffect`) wrote it too, and with two
 * writers the mirror can say the opposite of the DOM; nor does that notification hear the window come back.
 */
export function watchFocus(field: WatchedFocus, schedule: (run: () => void) => void): { afterUpdate: () => void; stop: () => void } {
  let queued = false;
  let stopped = false;
  const reconcileSoon = (): void => {
    if (queued || stopped) return;
    queued = true;
    schedule(() => {
      queued = false;
      if (stopped) return;
      const spec = focusMirrorSpec(field.state(), field.hasFocus());
      if (spec) field.dispatch(spec);
    });
  };
  for (const target of field.targets) for (const type of FOCUS_EVENTS) target.addEventListener(type, reconcileSoon);
  return {
    afterUpdate: () => {
      if (field.hasFocus() !== field.state().field(hasFocus)) reconcileSoon();
    },
    stop: () => {
      stopped = true;
      for (const target of field.targets) for (const type of FOCUS_EVENTS) target.removeEventListener(type, reconcileSoon);
    },
  };
}

const focusReconciler = ViewPlugin.define((view) => {
  const window = view.dom.ownerDocument.defaultView;
  const watcher = watchFocus(
    {
      targets: window ? [view.dom, window] : [view.dom],
      hasFocus: () => view.hasFocus,
      state: () => view.state,
      dispatch: (spec) => view.dispatch(spec),
    },
    queueMicrotask,
  );
  return { update: watcher.afterUpdate, destroy: watcher.stop };
});

/** The focus's mirror and its only writer. */
export function editorFocus(): Extension {
  return [hasFocus, focusReconciler];
}
