import { UnresolvedFile, WorkerPoolContext } from '@pierre/diffs/react';
import { useMemo, useRef } from 'react';
import { Button } from '../../../ui/Button';
import { useHighlightWorkers } from '../../diff/viewer/highlightWorkers';
import { PaneScrollbars } from '../../diff/viewer/PaneScrollbars';
import { highlightedLanguage, syntaxHighlighting } from '../../diff/viewer/syntaxHighlighting';
import type { MergeLabels } from '../mergeDescription';
import { conflictHunkCss, shortenBranch } from './conflictHunkCss';
import { conflictBases, keepConflictRegionBase, resolveConflictRegion, type ConflictDocument, type ConflictRegionChoice } from './threeWayMerge';
import { usePierreOptions } from './usePierreOptions';
import styles from './ConflictHunks.module.css';
import surface from './TextSurface.module.css';
import { shownText } from '../../../lib/lineBreaks';

interface ConflictHunksProps {
  path: string;
  /** The merged text, conflicts between markers. */
  text: string;
  labels: MergeLabels;
  /** The automatic merge, which knows each conflict's base: absent for a file with no base (added on both sides). */
  document?: ConflictDocument;
  /** Absent while the conflicts can't be decided here (a merge tool has the file): labels only, no choices. */
  onChange?: (text: string) => void;
}

/**
 * The merged file, read-only, shown with lone CRs as LFs; choices resolve the text with its own line breaks. Each conflict reads as two labeled blocks instead of raw markers: a header naming the
 * destination's side with the choices for this conflict, its lines, then the source's side and its lines.
 */
export function ConflictHunks({ path, text, labels, document, onChange }: ConflictHunksProps) {
  const pierreOptions = usePierreOptions(text);
  const bases = useMemo(() => (document ? conflictBases(text, document) : []), [text, document]);
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
                <HunkChoices
                  labels={labels}
                  conflictIndex={action.conflictIndex}
                  onChoose={(choice) => onChange(resolveConflictRegion(text, action.conflictIndex, choice))}
                  onKeepBase={withBase(bases[action.conflictIndex], (base) => onChange(keepConflictRegionBase(text, action.conflictIndex, base)))}
                />
              )}
            </div>
          )}
        />
      </WorkerPoolContext.Provider>
      <PaneScrollbars containerRef={surfaceRef} />
    </div>
  );
}

interface HunkChoicesProps {
  labels: MergeLabels;
  conflictIndex: number;
  onChoose: (choice: ConflictRegionChoice) => void;
  /** Absent when the conflict's base isn't known (no base, or its sides edited by hand). */
  onKeepBase?: () => void;
}

function HunkChoices({ labels, conflictIndex, onChoose, onKeepBase }: HunkChoicesProps) {
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
      {onKeepBase && (
        <Button size="small" variant="secondary" data-tip="As it was before either side changed it" onClick={onKeepBase}>
          Keep base
        </Button>
      )}
    </span>
  );
}

/** `keep` bound to the base, when there is one. */
function withBase(base: string | undefined, keep: (base: string) => void): (() => void) | undefined {
  return base === undefined ? undefined : () => keep(base);
}

/** A short key that changes whenever the text does. */
function contentKey(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = (hash * 33) ^ text.charCodeAt(index);
  return `${text.length}:${hash >>> 0}`;
}
