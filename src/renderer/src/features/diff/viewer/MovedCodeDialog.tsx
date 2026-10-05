import { FileDiff } from '@pierre/diffs/react';
import { useMemo } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import type { DisplayMeta } from './changeBlocks';
import type { ComparisonMethod } from './comparisonMethod';
import { useDiffPreferences } from './diffPreferencesStore';
import { lineDiff } from './lineDiff';
import type { MovedBlock } from './movedBlocks';
import { movedCopies } from './movedCopies';
import { pierreDiffOptions } from './pierreOptions';
import styles from './MovedCodeDialog.module.css';

interface MovedCodeComparison {
  move: MovedBlock;
  /** The diff the move is in. */
  meta: DisplayMeta;
  fileName: string;
  comparisonMethod: ComparisonMethod;
}

/** A row of the comparison, for its height: Pierre's line height, about. */
const ROW_HEIGHT = 20;

/**
 * Compares a move's two places, what moved with what it became (`movedCopies`): only what changed on the way shows
 * as changed. Read-only, in the diff's own look, layout and comparison method; lines are numbered from the start of
 * the moved code, the title says where it is.
 */
export function openMovedCodeDialog(comparison: MovedCodeComparison): void {
  openDialog((close) => <MovedCodeDialog {...comparison} onClose={close} />);
}

function MovedCodeDialog({ move, meta, fileName, comparisonMethod, onClose }: MovedCodeComparison & { onClose: () => void }) {
  const theme = useResolvedTheme();
  const { layout, wrapLines } = useDiffPreferences();
  const diff = useMemo(() => {
    const { original, modified } = movedCopies(meta, move);
    return lineDiff(original, modified, comparisonMethod, fileName);
  }, [meta, move, comparisonMethod, fileName]);
  const options = useMemo(
    () => ({ ...pierreDiffOptions({ theme, layout, collapseUnchanged: false, wrapLines }), parseDiffOptions: diff.options }),
    [theme, layout, wrapLines, diff.options],
  );
  const { deletions, additions } = move;
  const rows = layout === 'split' ? Math.max(deletions.count, additions.count) : deletions.count + additions.count;
  return (
    <Dialog
      title={`Moved from ${lines(deletions)} to ${lines(additions)}`}
      description={fileName}
      width={1100}
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className={styles.diff} style={{ height: `min(56vh, ${rows * ROW_HEIGHT + ROW_HEIGHT}px)` }}>
        <FileDiff fileDiff={diff.meta} options={options} />
      </div>
    </Dialog>
  );
}

function lines({ start, count }: MovedBlock['deletions']): string {
  return count === 1 ? `line ${start}` : `lines ${start}–${start + count - 1}`;
}
