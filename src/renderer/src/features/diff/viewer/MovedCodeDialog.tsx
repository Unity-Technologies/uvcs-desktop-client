import { File, FileDiff } from '@pierre/diffs/react';
import { useMemo, useRef } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { syntaxLanguage } from '../../../lib/syntaxLanguage';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import type { DisplayMeta } from './changeBlocks';
import type { ComparisonMethod } from './comparisonMethod';
import { useDiffPreferences } from './diffPreferencesStore';
import type { LineDiff } from './lineDiff';
import type { MovedBlock } from './movedBlocks';
import { movedComparison } from './movedComparison';
import { PaneScrollbars } from './PaneScrollbars';
import { pierreDiffOptions, pierreFileOptions } from './pierreOptions';
import styles from './MovedCodeDialog.module.css';

interface MovedCodeComparison {
  move: MovedBlock;
  /** The diff the move is in. */
  meta: DisplayMeta;
  fileName: string;
  comparisonMethod: ComparisonMethod;
}

/**
 * Compares a move's two places, what moved with what it became (`movedComparison`): only what changed on the way shows
 * as changed, and code moved as it was shows alone, saying so. Read-only, in the diff's own look, layout and comparison
 * method; lines are numbered from the start of the moved code, the title says where it is.
 */
export function openMovedCodeDialog(comparison: MovedCodeComparison): void {
  openDialog((close) => <MovedCodeDialog {...comparison} onClose={close} />);
}

function MovedCodeDialog({ move, meta, fileName, comparisonMethod, onClose }: MovedCodeComparison & { onClose: () => void }) {
  const comparison = useMemo(() => movedComparison(meta, move, comparisonMethod, fileName), [meta, move, comparisonMethod, fileName]);
  const { deletions, additions } = move;
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      title={`Moved from ${lines(deletions)} to ${lines(additions)}`}
      description={comparison.kind === 'unchanged' ? `${fileName} · ${comparison.note}` : fileName}
      width={1100}
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div ref={scroller} className={styles.diff}>
        {comparison.kind === 'unchanged' ? (
          <UnchangedCode code={comparison.code} fileName={fileName} />
        ) : (
          <ComparedCode diff={comparison.diff} />
        )}
        <PaneScrollbars containerRef={scroller} />
      </div>
    </Dialog>
  );
}

function ComparedCode({ diff }: { diff: LineDiff }) {
  const theme = useResolvedTheme();
  const { layout, wrapLines } = useDiffPreferences();
  const options = useMemo(
    () => ({ ...pierreDiffOptions({ theme, layout, collapseUnchanged: false, wrapLines }), parseDiffOptions: diff.options }),
    [theme, layout, wrapLines, diff.options],
  );
  return <FileDiff fileDiff={diff.meta} options={options} />;
}

function UnchangedCode({ code, fileName }: { code: string; fileName: string }) {
  const theme = useResolvedTheme();
  const { wrapLines } = useDiffPreferences();
  const file = useMemo(() => ({ name: fileName, lang: syntaxLanguage(fileName), contents: code }), [code, fileName]);
  const options = useMemo(() => pierreFileOptions({ theme, wrapLines }), [theme, wrapLines]);
  return <File file={file} options={options} />;
}

function lines({ start, count }: MovedBlock['deletions']): string {
  return count === 1 ? `line ${start}` : `lines ${start}–${start + count - 1}`;
}
