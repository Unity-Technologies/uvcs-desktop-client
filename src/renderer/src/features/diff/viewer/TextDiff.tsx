import { parseDiffFromFile, type DiffLineAnnotation } from '@pierre/diffs';
import { Editor } from '@pierre/diffs/edit';
import { EditProvider, MultiFileDiff } from '@pierre/diffs/react';
import { useMemo } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { BlockRevertBar } from './BlockRevertBar';
import { listChangeBlocks, revertChangeBlock } from './changeBlocks';
import { useDiffPreferences } from './diffPreferencesStore';
import { pierreDiffOptions, pierreThemeName } from './pierreOptions';
import { useSyntaxHighlighter } from './useSyntaxHighlighter';
import styles from './TextDiff.module.css';

interface TextDiffProps {
  original: string;
  modified: string;
  /** Used for the language of the syntax highlighting. */
  fileName: string;
  /** Lets the user type into the modified side. */
  editing?: boolean;
  /** Receives the modified side's text after every edit. */
  onEdit?: (text: string) => void;
  /** Offers to revert each change block; receives the modified text with that block put back as it was. */
  onRevertBlock?: (text: string) => void;
}

/** Annotations carry the index of the change block they stand for. */
type BlockIndex = number;

const createEditor: React.ComponentProps<typeof EditProvider>['createEditor'] = (type, options, key) => new Editor(type, options, key);

/** Syntax-highlighted text diff, side by side or unified, optionally editable on the modified side. */
export function TextDiff({ original, modified, fileName, editing = false, onEdit, onRevertBlock }: TextDiffProps) {
  const theme = useResolvedTheme();
  const { layout, collapseUnchanged, wrapLines } = useDiffPreferences();
  // Stable inputs: new objects would make Pierre reload the files and drop an ongoing edit.
  const oldFile = useMemo(() => ({ name: fileName, contents: original }), [fileName, original]);
  const newFile = useMemo(() => ({ name: fileName, contents: modified }), [fileName, modified]);
  const options = useMemo(
    () => pierreDiffOptions<BlockIndex>({ theme, layout, collapseUnchanged, wrapLines }),
    [theme, layout, collapseUnchanged, wrapLines],
  );
  const revertable = Boolean(onRevertBlock) && !editing;
  // The same diff Pierre computes for display, so each block lines up with what is shown.
  const meta = useMemo(() => (revertable ? parseDiffFromFile(oldFile, newFile) : null), [revertable, oldFile, newFile]);
  const blocks = useMemo(() => (meta ? listChangeBlocks(meta) : []), [meta]);
  const annotations = useMemo<DiffLineAnnotation<BlockIndex>[]>(() => blocks.map((block) => ({ ...block.anchor, metadata: block.index })), [blocks]);
  const canHighlight = useSyntaxHighlighter(pierreThemeName(theme), fileName);

  // Usually a few milliseconds, and only the first time a language shows up.
  if (!canHighlight) return <div className={styles.diff} />;

  const renderBlockBar = ({ metadata }: DiffLineAnnotation<BlockIndex>) => {
    const block = blocks[metadata];
    if (!meta || !block || !onRevertBlock) return null;
    return <BlockRevertBar block={block} onRevert={() => onRevertBlock(revertChangeBlock(meta, block))} />;
  };

  return (
    <div className={styles.diff}>
      <EditProvider createEditor={createEditor}>
        <MultiFileDiff<BlockIndex>
          oldFile={oldFile}
          newFile={newFile}
          options={options}
          lineAnnotations={annotations}
          renderAnnotation={renderBlockBar}
          edit={editing}
          onEditChange={(event) => onEdit?.(event.editor.getText())}
          onEditComplete={() => 'reject'}
          disableWorkerPool
          style={{ minHeight: '100%' }}
        />
      </EditProvider>
    </div>
  );
}
