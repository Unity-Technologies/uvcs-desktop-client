import { UnresolvedFile, WorkerPoolContext } from '@pierre/diffs/react';
import { useMemo, useRef } from 'react';
import { Button } from '../../../ui/Button';
import { useHighlightWorkers } from '../../diff/viewer/highlightWorkers';
import { PaneScrollbars } from '../../diff/viewer/PaneScrollbars';
import { highlightedLanguage, syntaxHighlighting } from '../../diff/viewer/syntaxHighlighting';
import type { MergeLabels } from '../mergeDescription';
import { conflictHunkCss, shortenBranch } from './conflictHunkCss';
import { resolveConflictRegion, type ConflictRegionChoice } from './threeWayMerge';
import { usePierreOptions } from './usePierreOptions';
import styles from './ConflictHunks.module.css';
import surface from './TextSurface.module.css';
import { shownText } from '../../../lib/lineBreaks';

interface ConflictHunksProps {
  path: string;
  /** The merged text, conflicts between markers. */
  text: string;
  labels: MergeLabels;
  /** Absent while the conflicts can't be decided here (a merge tool has the file): labels only, no choices. */
  onChange?: (text: string) => void;
}

/**
 * The merged file, read-only, shown with lone CRs as LFs; choices resolve the text with its own line breaks. Each conflict reads as two labeled blocks instead of raw markers: a header naming the
 * destination's side with the choices for this conflict, its lines, then the source's side and its lines.
 */
export function ConflictHunks({ path, text, labels, onChange }: ConflictHunksProps) {
  const pierreOptions = usePierreOptions();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const { source, destination } = labels.roles;
  // Highlighted like a read-only diff of its two sides, which Pierre highlights as a file each, about as long as the
  // text: in Pierre's workers past what the main thread highlights at once, plain past what's worth it.
  const highlighting = syntaxHighlighting(text, text, false);
  const tokenizeMaxLength = highlighting === 'off' ? 0 : undefined;
  const workers = useHighlightWorkers(highlighting === 'background');
  const options = useMemo(
    () => ({
      ...pierreOptions,
      tokenizeMaxLength,
      unsafeCSS: pierreOptions.unsafeCSS + conflictHunkCss(source.name, labels.source),
      // The source label is drawn by CSS inside the viewer: its full branch name goes in a tooltip on the row.
      onPostRender: (node: HTMLElement) => {
        for (const row of (node.shadowRoot ?? node).querySelectorAll<HTMLElement>('[data-merge-conflict=marker-separator]')) row.dataset.tip = `${source.name}: ${labels.source}`;
      },
    }),
    [pierreOptions, tokenizeMaxLength, source.name, labels.source],
  );

  return (
    <div ref={surfaceRef} className={surface.surface}>
      <WorkerPoolContext.Provider value={workers}>
        {/* The component keeps its own copy of the conflicts, so it is recreated whenever the text changes. */}
        <UnresolvedFile
          key={contentKey(text)}
          file={{ name: path, lang: highlightedLanguage(highlighting, path), contents: shownText(text) }}
          disableWorkerPool={!workers}
          options={options}
          renderMergeConflictUtility={(action) => (
            <div className={styles.hunkHeader}>
              <span className={styles.side} data-tip={`${destination.name}: ${labels.destination}`}>
                <span className={styles.role}>{destination.name}</span>
                <span className={styles.branch}>{shortenBranch(labels.destination)}</span>
              </span>
              {onChange && (
                <HunkChoices labels={labels} conflictIndex={action.conflictIndex} onChoose={(choice) => onChange(resolveConflictRegion(text, action.conflictIndex, choice))} />
              )}
            </div>
          )}
        />
      </WorkerPoolContext.Provider>
      <PaneScrollbars containerRef={surfaceRef} />
    </div>
  );
}

function HunkChoices({ labels, conflictIndex, onChoose }: { labels: MergeLabels; conflictIndex: number; onChoose: (choice: ConflictRegionChoice) => void }) {
  const { source, destination } = labels.roles;
  return (
    <span className={styles.choices} role="group" aria-label={`Resolve conflict ${conflictIndex + 1}`}>
      <Button size="small" variant="secondary" data-tip={`From ${labels.destination}`} onClick={() => onChoose('current')}>
        Keep {destination.name.toLowerCase()}
      </Button>
      <Button size="small" variant="secondary" data-tip={`From ${labels.source}`} onClick={() => onChoose('incoming')}>
        Keep {source.name.toLowerCase()}
      </Button>
      <Button size="small" variant="secondary" data-tip={`${destination.name} first, then ${source.name.toLowerCase()}`} onClick={() => onChoose('both')}>
        Keep both
      </Button>
    </span>
  );
}

/** A short key that changes whenever the text does. */
function contentKey(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = (hash * 33) ^ text.charCodeAt(index);
  return `${text.length}:${hash >>> 0}`;
}
