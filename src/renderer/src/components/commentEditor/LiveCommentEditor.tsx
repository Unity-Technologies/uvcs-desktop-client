import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useResolvedTheme } from '../../app/settings/useResolvedTheme';
import { pierreThemeName } from '../../lib/codeTheme';
import { classNames } from '../../lib/classNames';
import { commentEditorExtensions, editable, editableWhen, theme, themed, type CommentEditorKeys } from './commentEditorSetup';
import { ownerChange } from './oneLine';
import { ownerSync } from './ownerSync';
import type { CommentFieldProps } from './commentFieldProps';
import { activeFormats, FORMAT_COMMANDS, type FormatCommandId } from './formatCommands';
import { hasFocus, noteFocus } from './liveDecorations';
import type { Box } from './popupPosition';
import { SelectionBar } from './SelectionBar';
import { formatsOf, selectionBarShows } from './selectionBarState';
import { optionId, SuggestionList } from './SuggestionList';
import { isDismissed, isPickable, suggestionKeyAction } from './suggestionRows';
import { pickSuggestion, suggestionQueryAt, type SuggestionQuery } from './suggestionTrigger';
import { useSuggestionRows } from './useSuggestionRows';
import { WidgetPortals } from './widgetPortals';
import fieldStyles from './CommentField.module.css';
import styles from './LiveCommentEditor.module.css';

interface LiveCommentEditorProps extends CommentFieldProps {
  /** The caret in the plain field it replaces, which it takes over (`CommentField`). */
  initialFocus: { current: { at: number } | null };
}

/**
 * The comment editor (docs/features/rich-comments.md, "Writing"): CodeMirror over the comment's own text, drawn as it
 * reads around the caret, with the suggestion list and the selection bar. Its text is the stored comment, in and out.
 */
export function LiveCommentEditor({ value, onChange, singleLine = false, label, placeholder, autoFocus, disabled = false, onEnter, onSubmit, className, style, ref, initialFocus }: LiveCommentEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [portals] = useState(() => new WidgetPortals());
  const keys = useRef<CommentEditorKeys>({});
  keys.current = { onEnter, onSubmit };
  // Whether the user changed the text since the owner's value was last followed: the owner's answer to that change.
  const typedSinceSync = useRef(false);
  const changed = useRef(onChange);
  changed.current = onChange;
  const codeTheme = pierreThemeName(useResolvedTheme());

  // Built in the effect and destroyed in its cleanup, so StrictMode's second mount gets an editor of its own.
  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          commentEditorExtensions({ singleLine, label, placeholder, portals, keys }, !disabled, codeTheme),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.some((transaction) => transaction.annotation(ownerChange))) {
              typedSinceSync.current = true;
              changed.current(update.state.doc.toString());
            }
            if (update.docChanged || update.selectionSet || update.focusChanged || update.transactions.some((transaction) => transaction.effects.length > 0)) setState(update.state);
          }),
        ],
      }),
    });
    // What the editor took stays in it: ⌘B bolds here, and the window's ⌘B (New branch) never sees it. Listened to
    // after the editor's own handler, so its `preventDefault` tells.
    const keepTaken = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) event.stopPropagation();
    };
    editor.contentDOM.addEventListener('keydown', keepTaken);
    const caret = initialFocus.current?.at;
    if (caret !== undefined || autoFocus) {
      editor.dispatch({ selection: { anchor: Math.min(caret ?? value.length, editor.state.doc.length) } });
      editor.focus();
      noteFocus(editor);
    }
    setView(editor);
    setState(editor.state);
    return () => {
      editor.contentDOM.removeEventListener('keydown', keepTaken);
      editor.destroy();
      setView(null);
    };
    // One editor per mount: what changes while it shows reaches it through the effects below.
  }, []);

  // After each render, its change and its owner's answer both in: the text follows the owner's whenever they differ,
  // also when the owner kept its value (a summary given a line end keeps the line, `withSummaryText`).
  useEffect(() => {
    if (!view) return;
    const sync = ownerSync(view.state, value, typedSinceSync.current);
    typedSinceSync.current = false;
    if (sync) view.dispatch(sync);
  }, [view, value, state]);

  useEffect(() => view?.dispatch({ effects: editable.reconfigure(editableWhen(!disabled)) }), [view, disabled]);
  useEffect(() => view?.dispatch({ effects: theme.reconfigure(themed(codeTheme)) }), [view, codeTheme]);

  useImperativeHandle(ref, () => ({
    focus: () => view?.focus(),
    focusAtEnd: () => {
      if (!view) return;
      view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
      view.focus();
    },
  }));

  const suggestions = useSuggestions(view, state);
  const bar = useSelectionBar(view, state, singleLine, suggestions.shown);

  const widgets = useSyncExternalStore(portals.subscribe, portals.portals);
  // What React drew in the widgets changes their size: the editor measures its lines again.
  useLayoutEffect(() => view?.requestMeasure(), [view, widgets]);

  return (
    <div ref={host} className={classNames(fieldStyles.field, styles.editor, className)} style={style} data-single-line={singleLine || undefined} onMouseDown={bar.onPointerDown}>
      {widgets.map((widget) => createPortal(widget.node, widget.host, String(widget.key)))}
      {suggestions.list}
      {bar.element}
    </div>
  );
}

/** The suggestion list for what is typed at the caret: its rows, the key it's at, and the keys that walk it. */
function useSuggestions(view: EditorView | null, state: EditorState | null) {
  const listId = useId();
  const query = state && state.field(hasFocus) ? suggestionQueryAt(state) : null;
  // Esc closes the list until the word typed is another one.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const open: SuggestionQuery | null = query && !isDismissed(query, dismissedAt) ? query : null;
  useEffect(() => {
    if (!query) setDismissedAt(null);
  }, [query === null]);

  const { rows, searchAll } = useSuggestionRows(open);
  const shown = open !== null && rows.length > 0;
  const [active, setActive] = useState(0);
  const firstPickable = Math.max(0, rows.findIndex(isPickable));
  // A new list (the word typed, the search's answer) starts at its first row.
  const listKey = open ? `${open.kind}:${open.from}:${rows.map((row) => (row.kind === 'pick' ? row.suggestion.key : row.kind)).join()}` : '';
  useEffect(() => setActive(firstPickable), [listKey]);

  const pick = (index: number): void => {
    const row = rows[index];
    if (!view || !open || !row) return;
    if (row.kind === 'searchAll') searchAll(row.text);
    else if (row.kind === 'pick') view.dispatch(pickSuggestion(view.state, open, row.suggestion.insert));
  };

  // The list's keys come before the editor's and the dialog's (Esc would close it): taken on the way down.
  useEffect(() => {
    if (!shown || !view) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!view.dom.contains(event.target as Node) || event.isComposing) return;
      const action = suggestionKeyAction(event.key, event, rows, active);
      if (!action) return;
      if (action.kind === 'move') setActive(action.to);
      else if (action.kind === 'pick') pick(action.index);
      else setDismissedAt(open!.from);
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  });

  // The field is the list's combobox: screen readers follow the row the keys are at.
  const activeOption = rows[active] !== undefined && isPickable(rows[active]);
  useEffect(() => {
    if (!view) return;
    const content = view.contentDOM;
    content.setAttribute('aria-autocomplete', 'list');
    content.setAttribute('aria-expanded', String(shown));
    if (shown) content.setAttribute('aria-controls', listId);
    else content.removeAttribute('aria-controls');
    // Only an option the keys are at: a note ("Reading branches…") is no option.
    if (shown && activeOption) content.setAttribute('aria-activedescendant', optionId(listId, active));
    else content.removeAttribute('aria-activedescendant');
  }, [view, shown, active, listId, activeOption]);

  const anchor = shown && view ? boxAt(view, open!.from, open!.from) : null;
  const list = anchor ? <SuggestionList id={listId} rows={rows} active={active} anchor={anchor} onPick={pick} onHover={setActive} /> : null;
  return { shown, list };
}

/** The selection bar over text selected: shown once the pointer lets go, never with the suggestions open. */
function useSelectionBar(view: EditorView | null, state: EditorState | null, singleLine: boolean, suggesting: boolean) {
  const [pointerDown, setPointerDown] = useState(false);
  useEffect(() => {
    if (!pointerDown) return;
    const up = (): void => setPointerDown(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [pointerDown]);

  const shows = view !== null && state !== null && !suggesting && selectionBarShows(state, state.field(hasFocus), pointerDown);
  const element = shows ? (
    <SelectionBar
      formats={formatsOf(singleLine)}
      active={activeFormats(state)}
      anchor={selectionBox(view, state)}
      onFormat={(format: FormatCommandId) => {
        FORMAT_COMMANDS[format](view);
        view.focus();
      }}
    />
  ) : null;
  return { element, onPointerDown: () => setPointerDown(true) };
}

/** The selection's box in the window: its first line's, as wide as the selection runs on it. */
function selectionBox(view: EditorView, state: EditorState): Box {
  const { from, to } = state.selection.main;
  return boxAt(view, from, state.doc.lineAt(from).number === state.doc.lineAt(to).number ? to : from);
}

function boxAt(view: EditorView, from: number, to: number): Box {
  const start = view.coordsAtPos(from) ?? { left: 0, right: 0, top: 0, bottom: 0 };
  const end = view.coordsAtPos(to) ?? start;
  return { left: start.left, right: Math.max(end.right, start.left), top: start.top, bottom: start.bottom };
}
