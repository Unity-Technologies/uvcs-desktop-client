import { Editor } from '@pierre/diffs/edit';
import { EditProvider, File, MultiFileDiff } from '@pierre/diffs/react';
import { useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { focusMain } from '../../../lib/mainFocus';
import { matchesShortcut } from '../../../lib/shortcuts';
import { hotkey } from '../../../lib/shortcutRegistry';
import { lineDiffOptions, type ComparisonMethod } from './comparisonMethod';
import { useDiffPreferences } from './diffPreferencesStore';
import type { EditorHandle } from './editorHandle';
import { editsWholeFile } from './editsWholeFile';
import { pierreDiffOptions, pierreFileOptions, pierreThemeName } from './pierreOptions';
import { PaneScrollbars } from './PaneScrollbars';
import { replacementEdit } from './replacementEdit';
import { useBlockDiscard, type DiscardRequest } from './useBlockDiscard';
import { POINTER_FOCUS_ATTRIBUTE, usePointerFocusMark } from './usePointerFocusMark';
import { useShadowStyle } from './useShadowStyle';
import { useSyntaxHighlighter } from './useSyntaxHighlighter';
import styles from './TextDiff.module.css';

interface TextDiffProps {
  original: string;
  /** The modified text the diff starts from; changing it replaces what the editor holds. */
  modified: string;
  /** The modified text as it is now, with unsaved edits: what discards and a diff shown anew start from. */
  current: string;
  /** Used for the language of the syntax highlighting. */
  fileName: string;
  /** Which differences count; the text shown is always the original. */
  comparisonMethod: ComparisonMethod;
  /** The modified side is typed into directly (the whole file when the diff has no lines to show). */
  editable?: boolean;
  /** Receives the editor, to act on its text. */
  editorRef?: RefObject<EditorHandle | null>;
  /** Receives the modified side's text after every edit. */
  onEdit?: (text: string) => void;
  /** Offers to discard changes (whole or line by line); receives the modified text with them taken back. */
  onDiscard?: (request: DiscardRequest) => void;
  /** Undoes the last discard (⌘Z in the diff, outside the text). */
  onUndoDiscard?: () => void;
}

/**
 * Each side's code scrolls sideways, so Tab stops there to scroll it with the arrows: show where it stopped (after the
 * keyboard took it there, not a click). The caret's line keeps its diff color (the editor would tint it blue, like
 * picked lines): its number shows it.
 */
const SHADOW_CSS = [
  `[data-code]:focus-visible:not([${POINTER_FOCUS_ATTRIBUTE}]) { outline: var(--focus-outline); outline-offset: -2px; }`,
  '[data-editor-active-line]:not([data-selected-line]) { --diffs-editor-active-line-source-mix: 100%; --mix-selection-light: 100%; --mix-selection-dark: 100%; }',
].join('\n');

type CreateEditor = React.ComponentProps<typeof EditProvider>['createEditor'];

/** Creates the editors Pierre asks for, handing each one over: the diff acts on its text (discards, undo, focus). */
function editorFactory(onCreate: (editor: Editor) => void): CreateEditor {
  return (type, options, key) => {
    const created = new Editor(type, options, key);
    onCreate(created as unknown as Editor);
    return created;
  };
}

/** Syntax-highlighted text diff, side by side or unified, optionally typed into on the modified side. */
export function TextDiff({ original, modified, current, fileName, comparisonMethod, editable = false, editorRef, onEdit, onDiscard, onUndoDiscard }: TextDiffProps) {
  const theme = useResolvedTheme();
  const { layout, collapseUnchanged, wrapLines } = useDiffPreferences();
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const [createEditor] = useState(() => editorFactory((created) => (editor.current = created)));
  const wholeFile = useMemo(() => editable && editsWholeFile(original, modified, comparisonMethod), [editable, original, modified, comparisonMethod]);
  const currentText = useRef(current);
  currentText.current = current;
  // Stable inputs: new objects would make Pierre load the files again. A diff shown anew (another comparison method,
  // the whole file or its diff) starts from the text as it is now, unsaved edits included.
  const oldFile = useMemo(() => ({ name: fileName, contents: original }), [fileName, original]);
  const newFile = useMemo(() => ({ name: fileName, contents: currentText.current }), [fileName, modified, comparisonMethod, wholeFile]);
  const currentFile = useMemo(() => ({ name: fileName, contents: current }), [fileName, current]);
  const parseDiffOptions = lineDiffOptions(comparisonMethod);
  const discard = useBlockDiscard({ enabled: Boolean(onDiscard), oldFile, newFile: currentFile, comparisonMethod, layout, containerRef: container, onDiscard, onUndo: onUndoDiscard });
  const options = useMemo(
    () => ({ ...pierreDiffOptions({ theme, layout, collapseUnchanged, wrapLines }), parseDiffOptions, ...discard.options }),
    [theme, layout, collapseUnchanged, wrapLines, parseDiffOptions, discard.options],
  );
  const fileOptions = useMemo(() => pierreFileOptions({ theme, wrapLines }), [theme, wrapLines]);
  const canHighlight = useSyntaxHighlighter(pierreThemeName(theme), fileName);
  useShadowStyle(container, SHADOW_CSS);
  const pointerFocus = usePointerFocusMark();

  const isTyping = (): boolean => {
    const active = container.current?.querySelector('diffs-container')?.shadowRoot?.activeElement;
    return active instanceof HTMLElement && active.isContentEditable;
  };

  useImperativeHandle(
    editorRef,
    () => ({
      setText: (text) => {
        const edit = editor.current && replacementEdit(editor.current.getText(), text);
        if (edit) editor.current!.applyEdits([edit]);
      },
      undo: () => editor.current?.undo(),
      focus: () => {
        const hadCaret = (editor.current?.getViewState().selections?.length ?? 0) > 0;
        editor.current?.focus(hadCaret ? undefined : { lineNumber: 'first-visible' });
      },
      hasFocus: isTyping,
    }),
    [],
  );

  // Esc while typing drops the picked lines, then what the editor drops itself (a selection, extra carets), then
  // leaves the text for the file list. The edits stay.
  const onKeyDownCapture = (event: KeyboardEvent): void => {
    if (!isTyping() || !matchesShortcut(event.nativeEvent, hotkey('leaveEditor'))) return;
    const selections = editor.current?.getViewState().selections ?? [];
    const simple = selections.length <= 1 && selections.every(({ start, end }) => start.line === end.line && start.character === end.character);
    const droppedPick = discard.dropPickFirst(event);
    if (!droppedPick && !simple) return;
    event.preventDefault();
    event.stopPropagation();
    if (droppedPick) return;
    editor.current?.blur();
    focusMain(document);
  };

  // Keys the editor took (⌘Enter for a blank line, ⌘D for the next match, ⌘Z) are its own: the app's shortcuts
  // (check in, diff the file) don't see them.
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented && isTyping()) return event.stopPropagation();
    discard.onKeyDown(event);
  };

  // Usually a few milliseconds, and only the first time a language shows up.
  if (!canHighlight) return <div className={styles.diff} />;

  return (
    <div className={styles.frame}>
      <div
        ref={container}
        className={styles.diff}
        tabIndex={0}
        role="region"
        aria-label={`Diff of ${fileName}`}
        onKeyDownCapture={onKeyDownCapture}
        onKeyDown={onKeyDown}
        onPointerDown={discard.onPointerDown}
        onPointerDownCapture={pointerFocus.onPointerDownCapture}
        onPointerMove={discard.onPointerMove}
        onPointerLeave={discard.onPointerLeave}
        onFocus={pointerFocus.onFocus}
        onBlur={pointerFocus.onBlur}
      >
        <EditProvider createEditor={createEditor}>
          {wholeFile ? (
            <File file={newFile} options={fileOptions} edit onEditChange={(event) => onEdit?.(event.file.contents)} disableWorkerPool style={{ minHeight: '100%' }} />
          ) : (
            <MultiFileDiff
              // Pierre computes the diff once per pair of files, whatever the options say later.
              key={comparisonMethod}
              oldFile={oldFile}
              newFile={newFile}
              options={options}
              selectedLines={discard.selectedLines}
              renderGutterUtility={discard.renderGutterUtility}
              edit={editable}
              onEditChange={(event) => onEdit?.(event.editor.getText())}
              onEditComplete={() => 'reject'}
              disableWorkerPool
              style={{ minHeight: '100%' }}
            />
          )}
        </EditProvider>
        <PaneScrollbars containerRef={container} />
        {discard.overlay}
      </div>
    </div>
  );
}
