import { Editor } from '@pierre/diffs/edit';
import { EditProvider, MultiFileDiff } from '@pierre/diffs/react';
import { useMemo, useRef } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { lineDiffOptions, type ComparisonMethod } from './comparisonMethod';
import { useDiffPreferences } from './diffPreferencesStore';
import { pierreDiffOptions, pierreThemeName } from './pierreOptions';
import { useBlockDiscard, type DiscardRequest } from './useBlockDiscard';
import { useSyntaxHighlighter } from './useSyntaxHighlighter';
import styles from './TextDiff.module.css';

interface TextDiffProps {
  original: string;
  modified: string;
  /** Used for the language of the syntax highlighting. */
  fileName: string;
  /** Which differences count; the text shown is always the original. */
  comparisonMethod: ComparisonMethod;
  /** Lets the user type into the modified side. */
  editing?: boolean;
  /** Receives the modified side's text after every edit. */
  onEdit?: (text: string) => void;
  /** Offers to discard changes (whole or line by line); receives the modified text with them taken back. */
  onDiscard?: (request: DiscardRequest) => void;
  /** Undoes the last discard (⌘Z in the diff). */
  onUndoDiscard?: () => void;
}

const createEditor: React.ComponentProps<typeof EditProvider>['createEditor'] = (type, options, key) => new Editor(type, options, key);

/** Syntax-highlighted text diff, side by side or unified, optionally editable on the modified side. */
export function TextDiff({ original, modified, fileName, comparisonMethod, editing = false, onEdit, onDiscard, onUndoDiscard }: TextDiffProps) {
  const theme = useResolvedTheme();
  const { layout, collapseUnchanged, wrapLines } = useDiffPreferences();
  const container = useRef<HTMLDivElement>(null);
  // Stable inputs: new objects would make Pierre reload the files and drop an ongoing edit.
  const oldFile = useMemo(() => ({ name: fileName, contents: original }), [fileName, original]);
  const newFile = useMemo(() => ({ name: fileName, contents: modified }), [fileName, modified]);
  const parseDiffOptions = lineDiffOptions(comparisonMethod);
  const discard = useBlockDiscard({ enabled: Boolean(onDiscard) && !editing, oldFile, newFile, comparisonMethod, layout, containerRef: container, onDiscard, onUndo: onUndoDiscard });
  const options = useMemo(
    () => ({ ...pierreDiffOptions({ theme, layout, collapseUnchanged, wrapLines }), parseDiffOptions, ...discard.options }),
    [theme, layout, collapseUnchanged, wrapLines, parseDiffOptions, discard.options],
  );
  const canHighlight = useSyntaxHighlighter(pierreThemeName(theme), fileName);

  // Usually a few milliseconds, and only the first time a language shows up.
  if (!canHighlight) return <div className={styles.diff} />;

  return (
    <div ref={container} className={styles.diff} tabIndex={-1} onKeyDown={discard.onKeyDown} onPointerDown={discard.onPointerDown}>
      <EditProvider createEditor={createEditor}>
        <MultiFileDiff
          // Pierre computes the diff once per pair of files, whatever the options say later.
          key={comparisonMethod}
          oldFile={oldFile}
          newFile={newFile}
          options={options}
          selectedLines={discard.selectedLines}
          renderGutterUtility={discard.renderGutterUtility}
          edit={editing}
          onEditChange={(event) => onEdit?.(event.editor.getText())}
          onEditComplete={() => 'reject'}
          disableWorkerPool
          style={{ minHeight: '100%' }}
        />
      </EditProvider>
      {discard.overlay}
    </div>
  );
}
