import { AlertTriangle, ArrowDownToLine, Eye } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MergePlan, MergeRequest } from '@shared/domain/merge';
import { shortBranchName } from '@shared/domain/specs';
import { updateWorkspace } from '../../app/shell/workspaceOperations';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { PathLabel } from '../../components/PathLabel';
import { textMeasurer } from '../../lib/measureText';
import { useShortcut } from '../../lib/useShortcut';
import { Button } from '../../ui/Button';
import { Kbd } from '../../ui/Kbd';
import { useIncomingSummary } from '../incoming/useIncomingSummary';
import { fitMergeTitle } from './fitMergeTitle';
import { MergeContributors } from './MergeContributors';
import { mergeTitle, mergeTitleText, type MergeLabels, type MergeTitle } from './mergeDescription';
import styles from './MergeHeader.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

interface MergeHeaderProps {
  request: MergeRequest;
  plan: MergePlan;
  labels: MergeLabels;
  /** Where the merge stands in a few words, e.g. "2 conflicts to decide". */
  progress: string;
  /** What the plan holds and where its conflicts stand, e.g. "598 changes to apply · 2 conflicts: …". */
  summary: string;
  intoServerBranch: boolean;
  comment: string;
  onCommentChange: (comment: string) => void;
  canMerge: boolean;
  merging: boolean;
  onMerge: () => void;
}

export function MergeHeader({
  request,
  plan,
  labels,
  progress,
  summary,
  intoServerBranch,
  comment,
  onCommentChange,
  canMerge,
  merging,
  onMerge,
}: MergeHeaderProps) {
  useShortcut(hotkey('merge'), onMerge, canMerge);
  // Stable while the request is, so the title is fitted again only when it changes or its room does.
  const title = useMemo(() => mergeTitle(request, labels.destination), [request, labels.destination]);

  // One primary action at a time: while conflicts wait, resolving them is (in the file's toolbar); then completing.
  const mergeButton = (
    <Button variant={canMerge ? 'primary' : 'secondary'} disabled={!canMerge} loading={merging} onClick={onMerge}>
      {/* The title names the whole destination; the button keeps its leaf, leaving room for the rest of the row. */}
      {intoServerBranch ? `Merge into ${shortBranchName(labels.destination)}` : 'Complete merge'}
      <Kbd keys={hotkey('merge')} />
    </Button>
  );

  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <span className={styles.preview} data-tip={intoServerBranch ? 'Nothing is created until you merge' : 'Nothing is written until you complete the merge'}>
          <Eye size={12} />
          Preview
        </span>
        <MergeHeading title={title} />
        {plan.contributors && <MergeContributors contributors={plan.contributors} labels={labels} />}
        <span className={styles.status} data-tip={summary}>
          {progress}
        </span>
        {!intoServerBranch && mergeButton}
      </div>

      {intoServerBranch && (
        <div className={styles.row}>
          <input
            className={styles.comment}
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Changeset comment"
            aria-label="Changeset comment"
          />
          <div className={styles.spacer} />
          {mergeButton}
        </div>
      )}

      {!intoServerBranch && <BehindHeadNotice />}
      {plan.warnings.map((warning) => (
        <div key={warning} className={styles.notice}>
          <AlertTriangle size={13} />
          {warning}
        </div>
      ))}
    </header>
  );
}

/** "Merge /main/…/task into /main": fitted as a whole, the branches give way from their middle and the words stay. */
function MergeHeading({ title }: { title: MergeTitle }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [fitted, setFitted] = useState(title);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // A few pixels to spare for the gaps between the parts, which the measure of their text leaves out.
    const fit = (): void => setFitted(fitMergeTitle(title, element.clientWidth - 8, textMeasurer(element)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [title]);

  return (
    <h1 ref={ref} className={styles.title} data-tip={mergeTitleText(title)}>
      <span className={styles.titleWord}>{fitted.verb}</span>
      <PathLabel path={fitted.source} fitContent tooltip={false} />
      <span className={styles.titleWord}>{fitted.preposition}</span>
      <PathLabel path={fitted.destination} fitContent tooltip={false} />
    </h1>
  );
}

/** Merging into an outdated workspace works, but checking in the result will need an update first. */
function BehindHeadNotice() {
  const workspacePath = useWorkspacePath();
  const { data: incoming } = useIncomingSummary();
  if (!incoming?.changesetCount) return null;

  return (
    <div className={styles.notice}>
      <ArrowDownToLine size={13} />
      Your workspace is {incoming.changesetCount} {incoming.changesetCount === 1 ? 'changeset' : 'changesets'} behind {incoming.branch}. Update first
      to merge into the latest version.
      <Button size="small" onClick={() => void updateWorkspace(workspacePath)}>
        Update
      </Button>
    </div>
  );
}
