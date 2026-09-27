import { Virtualizer } from '@pierre/diffs';
import { Editor } from '@pierre/diffs/edit';
import { EditProvider, File, FileDiff, VirtualizerContext, WorkerPoolContext } from '@pierre/diffs/react';
import { useCallback, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { focusMain } from '../../../lib/mainFocus';
import { matchesShortcut } from '../../../lib/shortcuts';
import { hotkey } from '../../../lib/shortcutRegistry';
import type { ComparisonMethod } from './comparisonMethod';
import { useDiffPreferences } from './diffPreferencesStore';
import type { EditorHandle } from './editorHandle';
import { escapeWhileTyping } from './escapeWhileTyping';
import { highlightWorkers } from './highlightWorkers';
import type { LineDiff } from './lineDiff';
import { HIDE_NO_NEWLINE_CSS, showsNoNewlineMarker } from './noNewlineMarker';
import { pierreDiffOptions, pierreFileOptions, pierreThemeName } from './pierreOptions';
import { PaneScrollbars } from './PaneScrollbars';
import { installPierreLineComparison } from './pierreLineComparison';
import { replacementEdit } from './replacementEdit';
import { caretLineCss, shownDiff, type DiffSides } from './shownDiff';
import { highlightedLanguage, syntaxHighlighting } from './syntaxHighlighting';
import { useBlockDiscard, type DiscardRequest } from './useBlockDiscard';
import { POINTER_FOCUS_ATTRIBUTE, usePointerFocusMark } from './usePointerFocusMark';
import { useShadowStyle } from './useShadowStyle';
import { useSyntaxHighlighter } from './useSyntaxHighlighter';
import styles from './TextDiff.module.css';
import { shownText } from '../../../lib/lineBreaks';

const BOTH_SIDES: DiffSides = { original: true, modified: true };

// Typing re-diffs the text in Pierre: under the comparison method, like the diff it starts from.
installPierreLineComparison();

/**
 * The texts are the files' own, their lines broken by LF, CRLF or lone CRs. Pierre is given them as shown, lone CRs as
 * LFs (`shownText`), and the editor holds them so: what it reports goes back to the file's own line breaks upstream.
 */
interface TextDiffProps {
  original: string;
  /** The modified text the diff starts from; changing it replaces what the editor holds. */
  modified: string;
  /** The modified text as it is now, with unsaved edits. */
  current: string;
  /** The diff of `original` and `diffedText` under `comparisonMethod` (`lineDiff`): shown, and discarded from. */
  diff: LineDiff;
  /**
   * The modified text `diff` is of, what discards and a diff shown anew start from: `current`, or while a big text is
   * typed into, the text as it was when typing last paused (`diffsEveryKeystroke`).
   */
  diffedText: string;
  /** The modified side is typed into whole, without a diff: the diff has no lines to show. */
  wholeFile?: boolean;
  /** Used for the language of the syntax highlighting. */
  fileName: string;
  /** Which differences count; the text shown is always the original. */
  comparisonMethod: ComparisonMethod;
  /** Which sides are real versions: an added or private item shows alone, without an empty side next to it. */
  sides?: DiffSides;
  /** The modified side is typed into directly. */
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
 * picked lines): its number shows it. "No newline at end of file" reads as a note about the line above, not as one
 * more line of the file.
 */
const SHADOW_CSS = [
  '[data-no-newline] span { font-family: var(--font-ui); font-size: var(--text-xs); font-style: italic; }',
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
export function TextDiff({ original, modified, current, diff, diffedText, wholeFile = false, fileName, comparisonMethod, sides = BOTH_SIDES, editable = false, editorRef, onEdit, onDiscard, onUndoDiscard }: TextDiffProps) {
  const theme = useResolvedTheme();
  const { layout, collapseUnchanged, wrapLines } = useDiffPreferences();
  const container = useRef<HTMLDivElement | null>(null);
  // The whole file (and a big read-only diff) renders only the lines in view: files can be huge.
  const [virtualizer] = useState(() => new Virtualizer());
  const setContainer = useCallback(
    (element: HTMLDivElement | null) => {
      container.current = element;
      if (element) virtualizer.setup(element);
      else virtualizer.cleanUp();
    },
    [virtualizer],
  );
  const editor = useRef<Editor | null>(null);
  const [createEditor] = useState(() => editorFactory((created) => (editor.current = created)));
  const latest = useRef({ current: diffedText, diff });
  latest.current = { current: diffedText, diff };
  // Stable inputs: new objects would make Pierre load the files again. While the text is typed into, Pierre works out
  // the diff itself (with the same options, `pierreLineComparison`); a diff shown anew (another comparison method, the
  // whole file or its diff, the file saved or changed on disk) starts from the text as it is now, unsaved edits included.
  // A big diff renders only the lines in view; a read-only one shows as plain text at once and highlights in Pierre's
  // workers; past what's worth it, Pierre shows files with more lines than `tokenizeMaxLength` as plain text.
  const highlighting = syntaxHighlighting(original, modified, editable);
  const lang = highlightedLanguage(highlighting, fileName);
  const newFile = useMemo(() => ({ name: fileName, lang, contents: shownText(latest.current.current) }), [fileName, lang, modified, comparisonMethod, wholeFile]);
  const fileDiff = useMemo(
    () => ({ ...shownDiff(latest.current.diff.meta, sides, original, latest.current.current, editable), lang }),
    [fileName, lang, original, modified, comparisonMethod, wholeFile, sides.original, sides.modified, editable],
  );
  const parseDiffOptions = diff.options;
  const discard = useBlockDiscard({
    enabled: Boolean(onDiscard),
    diff: diff.meta,
    texts: { original, modified: diffedText },
    typed: current,
    comparisonMethod,
    layout,
    containerRef: container,
    onDiscard,
    onUndo: onUndoDiscard,
  });
  const tokenizeMaxLength = highlighting === 'off' ? 0 : undefined;
  const workers = highlighting === 'background' ? highlightWorkers() : undefined;
  const virtualized = highlighting !== 'inline';
  const options = useMemo(
    () => ({ ...pierreDiffOptions({ theme, layout, collapseUnchanged, wrapLines }), parseDiffOptions, tokenizeMaxLength, ...discard.options }),
    [theme, layout, collapseUnchanged, wrapLines, parseDiffOptions, tokenizeMaxLength, discard.options],
  );
  const fileOptions = useMemo(() => ({ ...pierreFileOptions({ theme, wrapLines }), tokenizeMaxLength }), [theme, wrapLines, tokenizeMaxLength]);
  const canHighlight = useSyntaxHighlighter(pierreThemeName(theme), fileName);
  useShadowStyle(container, [SHADOW_CSS, showsNoNewlineMarker(original, diffedText) ? '' : HIDE_NO_NEWLINE_CSS, editable ? caretLineCss(shownText(diffedText)) : ''].join('\n'));
  const pointerFocus = usePointerFocusMark();

  const isTyping = (): boolean => {
    const active = container.current?.querySelector('diffs-container')?.shadowRoot?.activeElement;
    return active instanceof HTMLElement && active.isContentEditable;
  };

  useImperativeHandle(
    editorRef,
    () => ({
      setText: (text) => {
        const edit = editor.current && replacementEdit(editor.current.getText(), shownText(text));
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

  const onKeyDownCapture = (event: KeyboardEvent): void => {
    if (!isTyping() || !matchesShortcut(event.nativeEvent, hotkey('leaveEditor'))) return;
    const action = escapeWhileTyping(editor.current?.getViewState().selections ?? [], discard.dropPickFirst(event));
    if (action === 'editor') return;
    event.preventDefault();
    event.stopPropagation();
    if (action === 'pick') return;
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
        ref={setContainer}
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
            <VirtualizerContext.Provider value={virtualizer}>
              <File file={newFile} options={fileOptions} edit onEditChange={(event) => onEdit?.(event.file.contents)} disableWorkerPool style={{ minHeight: '100%' }} />
            </VirtualizerContext.Provider>
          ) : (
            <VirtualizerContext.Provider value={virtualized ? virtualizer : undefined}>
              <WorkerPoolContext.Provider value={workers}>
                <FileDiff
                  // Pierre computes the diff once per pair of files, whatever the options say later, and takes the
                  // workers (never for an editable diff) and virtualizer when it's created; typing doesn't start it anew.
                  key={`${comparisonMethod}:${editable ? 'editable' : highlighting}:${virtualized}`}
                  fileDiff={fileDiff}
                  options={options}
                  selectedLines={discard.selectedLines}
                  renderGutterUtility={discard.renderGutterUtility}
                  edit={editable}
                  onEditChange={(event) => onEdit?.(event.editor.getText())}
                  onEditComplete={() => 'reject'}
                  disableWorkerPool={!workers}
                  style={{ minHeight: '100%' }}
                />
              </WorkerPoolContext.Provider>
            </VirtualizerContext.Provider>
          )}
        </EditProvider>
        <PaneScrollbars containerRef={container} />
        {discard.overlay}
      </div>
    </div>
  );
}
