import { UnresolvedFile } from '@pierre/diffs/react';
import { Button } from '../../../ui/Button';
import type { MergeLabels } from '../mergeDescription';
import { resolveConflictRegion, type ConflictRegionChoice } from './threeWayMerge';
import { usePierreOptions } from './usePierreOptions';
import styles from './ConflictHunks.module.css';
import surface from './TextSurface.module.css';

interface ConflictHunksProps {
  path: string;
  /** The merged text, conflicts between markers. */
  text: string;
  labels: MergeLabels;
  onChange: (text: string) => void;
}

/** The merged file, read-only, with each conflict offering to keep the destination's lines, the source's or both. */
export function ConflictHunks({ path, text, labels, onChange }: ConflictHunksProps) {
  const options = usePierreOptions();
  const choose = (conflictIndex: number, choice: ConflictRegionChoice): void => onChange(resolveConflictRegion(text, conflictIndex, choice));
  const { source, destination } = labels.roles;

  return (
    <div className={surface.surface}>
      {/* The component keeps its own copy of the conflicts, so it is recreated whenever the text changes. */}
      <UnresolvedFile
        key={contentKey(text)}
        file={{ name: path, contents: text }}
        disableWorkerPool
        options={options}
        renderMergeConflictUtility={(action) => (
          <div className={styles.conflictActions}>
            <Button size="small" data-tip={`Keep these lines as ${labels.destination} has them`} onClick={() => choose(action.conflictIndex, 'current')}>
              Keep {destination.name.toLowerCase()}
            </Button>
            <Button size="small" data-tip={`Keep these lines as ${labels.source} has them`} onClick={() => choose(action.conflictIndex, 'incoming')}>
              Keep {source.name.toLowerCase()}
            </Button>
            <Button
              size="small"
              variant="ghost"
              data-tip={`Keep the lines of both: ${labels.destination} first, then ${labels.source}`}
              onClick={() => choose(action.conflictIndex, 'both')}
            >
              Keep both
            </Button>
          </div>
        )}
      />
    </div>
  );
}

/** A short key that changes whenever the text does. */
function contentKey(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = (hash * 33) ^ text.charCodeAt(index);
  return `${text.length}:${hash >>> 0}`;
}
