import { EditorState } from '@codemirror/state';
import { EditorView, placeholder as placeholderOf } from '@codemirror/view';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useContext, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useResolvedTheme } from '../../app/settings/useResolvedTheme';
import { pierreThemeName } from '../../lib/codeTheme';
import { classNames } from '../../lib/classNames';
import { isInModalDialog } from '../../lib/modalDialog';
import { isMac } from '../../lib/platform';
import { hotkey } from '../../lib/shortcutRegistry';
import { FocusGroupContext, type FocusGroup } from './CommentFocusGroup';
import { groupMove } from './focusGroup';
import { focusModeKey, focusModeLayout, focusModeParts, layoutAfterFocus, type FocusModeLayout } from './focusMode';
import { commentEditorExtensions, editable, editableWhen, placeholderText, theme, themed, type CommentEditorKeys } from './commentEditorSetup';
import { placeholderShown } from './commentPlaceholders';
import { FocusModeFooter } from './FocusModeFooter';
import { FormatToolbar } from './FormatToolbar';
import { ownerChange } from './oneLine';
import { ownerSync } from './ownerSync';
import type { CommentFieldProps } from './commentFieldProps';
import { activeFormats, FORMAT_COMMANDS, type FormatCommandId } from './formatCommands';
import { fieldFocused, focusEditor } from './editorFocus';
import type { Box } from './popupPosition';
import { SelectionBar } from './SelectionBar';
import { formatsOf } from './formatActions';
import { pressPlacesCaret } from './pressPlacement';
import { pressHidesBar, selectionBarShows } from './selectionBarState';
import { optionId, SuggestionList } from './SuggestionList';
import { isPickable, suggestionKeyAction } from './suggestionRows';
import { pickSuggestion, suggestionGate, suggestionsShownAt, type SuggestionQuery } from './suggestionTrigger';
import { setSuggestionCue } from './suggestionCueField';
import { suggestionCue } from './suggestionSource';
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
export function LiveCommentEditor({ value, onChange, singleLine = false, label, labelledBy, groupField, placeholder, autoFocus, disabled = false, onEnter, onSubmit, className, style, ref, initialFocus }: LiveCommentEditorProps) {
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
          commentEditorExtensions({ singleLine, label, labelledBy, placeholder, portals, keys }, !disabled, codeTheme),
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
      focusEditor(editor);
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

  const handle = useMemo(
    () => ({
      focus: () => view && focusEditor(view),
      focusAtEnd: () => focusAt(view, view?.state.doc.length ?? 0),
      focusAtStart: () => focusAt(view, 0),
    }),
    [view],
  );
  useImperativeHandle(ref, () => handle, [handle]);
  const group = useContext(FocusGroupContext);
  const grouped = group && groupField ? { group, field: groupField } : null;
  useEffect(() => {
    if (!group || !groupField) return;
    group.register(groupField, handle);
    return () => group.register(groupField, null);
  }, [group, groupField, handle]);
  // ↓ and ↑ between the group's fields, and in focus mode Tab too: out of it Tab goes on through the form.
  keys.current.groupKey = grouped
    ? (editor, key) => {
          if (!grouped.group.open && (key === 'Tab' || key === 'ShiftTab')) return false;
          const head = editor.state.selection.main.head;
          const move = groupMove(grouped.field, key, { atEnd: head === editor.state.doc.length, onFirstLine: onFirstVisualLine(editor, head) });
          if (!move) return false;
          grouped.group.moveTo(move.to, move.caret);
          return true;
        }
    : undefined;

  const suggestions = useSuggestions(view, state);
  const focus = useFocusMode(view, state, host, singleLine, suggestions.shown, grouped?.group ?? null);
  const bar = useSelectionBar(view, state, singleLine, suggestions.shown, focus.inFocusMode);
  keys.current.takesTab = focus.parts.takesTab;
  useEffect(
    () => view?.dispatch({ effects: placeholderText.reconfigure(placeholderOf(placeholderShown(placeholder, { focusMode: focus.inFocusMode, singleLine }))) }),
    [view, placeholder, focus.inFocusMode, singleLine],
  );

  const widgets = useSyncExternalStore(portals.subscribe, portals.portals);
  // What React drew in the widgets changes their size: the editor measures its lines again.
  useLayoutEffect(() => view?.requestMeasure(), [view, widgets]);

  return (
    <div
      ref={host}
      className={classNames(fieldStyles.field, styles.editor, className)}
      style={style}
      data-single-line={singleLine || undefined}
      data-group-field={groupField}
      data-expanded={focus.parts.layout ?? undefined}
      data-focus-mode={focus.parts.toolbar || undefined}
      onMouseDown={(event) => {
        bar.onPointerDown(event);
        if (view) caretAtPress(view, event);
      }}
    >
      {focus.element}
      {/* The top strip of the comment it formats (in the check-in, the description's). */}
      {focus.parts.toolbar && view && state && <FormatToolbar view={view} state={state} focused={fieldFocused(view, state)} />}
      {focus.parts.footer && (
        <div className={styles.footer}>
          <FocusModeFooter />
        </div>
      )}
      {widgets.map((widget) => createPortal(widget.node, widget.host, String(widget.key)))}
      {suggestions.list}
      {bar.element}
    </div>
  );
}

/**
 * Focus mode (`focusMode`): the field grows into a large editor and back, by its corner button, its shortcut or Esc.
 * The same editor, so its text, caret and selection stay.
 */
function useFocusMode(view: EditorView | null, state: EditorState | null, host: RefObject<HTMLDivElement | null>, singleLine: boolean, suggesting: boolean, group: FocusGroup | null) {
  const [ownLayout, setOwnLayout] = useState<FocusModeLayout | null>(null);
  // In a group (the check-in), focus mode is the group's: both its fields, from either of them.
  const parts = focusModeParts({ singleLine, inGroup: group !== null, groupOpen: group?.open ?? false, ownLayout });
  const close = (): void => {
    if (group) group.close();
    else setOwnLayout(null);
  };
  const toggle = (): void => {
    if (group) group.toggle();
    else setOwnLayout((shown) => (shown ? null : focusModeLayout(isInModalDialog(host.current))));
    if (view) focusEditor(view);
  };
  // What the key handler reads when a key comes, without listening again at each render.
  const latest = useRef({ expanded: parts.inFocusMode, suggesting, toggle, close });
  latest.current = { expanded: parts.inFocusMode, suggesting, toggle, close };
  useEffect(() => {
    if (!view || !parts.offered) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!view.dom.contains(event.target as Node)) return;
      const action = focusModeKey(event, isMac, { expanded: latest.current.expanded, suggesting: latest.current.suggesting });
      if (!action) return;
      if (action === 'submitting') {
        latest.current.close();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (action === 'toggle') latest.current.toggle();
      else latest.current.close();
    };
    // Taken on the way down, before a dialog's Esc closes it or the details' Esc cancels the edit.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [view, parts.offered]);
  // Out of it once the focus leaves the editor: a dialog it opened (⌘↵'s question) never shows behind it.
  const focused = state ? fieldFocused(view, state) : false;
  // A group's fields hand the focus to each other: the group tells leaving itself (`CommentFocusGroup`).
  useEffect(() => {
    if (!group && ownLayout && !focused) setOwnLayout(layoutAfterFocus(ownLayout, focused));
  }, [group, ownLayout, focused]);
  // Focus mode has Tab for its fields (the text's, or the group's move to the description): CodeMirror's Esc-then-Tab
  // escape (its tab focus mode, on for two seconds after an Esc it saw, as one closing the suggestions before ⇧⌘F)
  // would skip their bindings and hand Tab to the window. Out of focus mode, Esc then Tab still leaves the field, so
  // the keyboard is never trapped.
  useEffect(() => {
    if (view && parts.inFocusMode) view.setTabFocusMode(false);
  }, [view, parts.inFocusMode]);
  // As its size changes, the caret stays in view: centered in the larger editor, the least scroll back in the field.
  const previous = useRef(parts.inFocusMode);
  useLayoutEffect(() => {
    if (!view || previous.current === parts.inFocusMode) return;
    previous.current = parts.inFocusMode;
    view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: parts.inFocusMode ? 'center' : 'nearest' }) });
  }, [view, parts.inFocusMode]);
  const button = parts.button;
  const Icon = button?.icon === 'collapse' ? Minimize2 : Maximize2;
  const element = (
    <>
      {parts.backdrop && createPortal(<div className={styles.backdrop} onMouseDown={close} />, document.body)}
      {button && (
        <button
          type="button"
          className={styles.expand}
          aria-label={button.label}
          data-tip={button.label}
          data-tip-shortcut={hotkey('commentFocusMode')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle}
        >
          <Icon size={13} strokeWidth={2} aria-hidden />
        </button>
      )}
    </>
  );
  return { parts, inFocusMode: parts.inFocusMode, element };
}

/**
 * A press in the field's box but not on its text (under the last line, its padding) puts the caret where the press
 * is, as on the text: the editor is only as tall as its text, and the rest of a tall box was dead to the pointer.
 */
function caretAtPress(view: EditorView, event: React.MouseEvent): void {
  const target = event.target as Element;
  const press = { button: event.button, onText: view.contentDOM.contains(target), inBox: view.dom.parentElement?.contains(target) ?? false, onControl: target.closest('button, [role="toolbar"], a') !== null };
  if (!pressPlacesCaret(press)) return;
  event.preventDefault();
  focusAt(view, view.posAtCoords({ x: event.clientX, y: event.clientY }, false));
}

/** Puts the caret at `at` and the focus in the editor. */
function focusAt(view: EditorView | null, at: number): void {
  if (!view) return;
  view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
  focusEditor(view);
}

/** Whether `head` is on the text's first line as shown, a wrapped first line's later rows excluded. */
function onFirstVisualLine(view: EditorView, head: number): boolean {
  const here = view.coordsAtPos(head);
  const first = view.coordsAtPos(0);
  return !here || !first || Math.abs(here.top - first.top) < 2;
}

/** The suggestion list for what is typed at the caret: its rows, the key it's at, and the keys that walk it. */
function useSuggestions(view: EditorView | null, state: EditorState | null) {
  const listId = useId();
  // The DOM's focus, never the mirror alone (`editorFocused`): a mirror behind once hid the list for good.
  const focused = state ? fieldFocused(view, state) : false;
  const query = state && focused ? suggestionsShownAt(state) : null;
  // Esc closes the list until the word typed is another one.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const open: SuggestionQuery | null = state ? suggestionGate(state, focused, dismissedAt) : null;
  useEffect(() => {
    if (!query) setDismissedAt(null);
  }, [query === null]);

  const { rows, reading, searchAll } = useSuggestionRows(open);
  // The cue at the word typed, apart from the list: the field shows it understood the trigger whatever the list does.
  const cue = suggestionCue({ recognized: query !== null, dismissed: query !== null && open === null, reading });
  const cueRange = query && cue ? { from: query.from, to: query.to, state: cue } : null;
  const cueKey = cueRange ? `${cueRange.from}:${cueRange.to}:${cueRange.state}` : '';
  useEffect(() => {
    view?.dispatch({ effects: setSuggestionCue.of(cueRange) });
  }, [view, cueKey]);
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
function useSelectionBar(view: EditorView | null, state: EditorState | null, singleLine: boolean, suggesting: boolean, focusMode: boolean) {
  const [pointerDown, setPointerDown] = useState(false);
  useEffect(() => {
    if (!pointerDown) return;
    const up = (): void => setPointerDown(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [pointerDown]);

  const shows = view !== null && state !== null && !suggesting && selectionBarShows(state, fieldFocused(view, state), pointerDown, focusMode);
  const element = shows ? (
    <SelectionBar
      formats={formatsOf(singleLine)}
      active={activeFormats(state)}
      anchor={selectionBox(view, state)}
      onFormat={(format: FormatCommandId) => {
        FORMAT_COMMANDS[format](view);
        focusEditor(view);
      }}
    />
  ) : null;
  return {
    element,
    onPointerDown: (event: React.MouseEvent<HTMLElement>) => {
      if (pressHidesBar(event.currentTarget, event.target)) setPointerDown(true);
    },
  };
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
