import { AlertTriangle, ArrowDownToLine, GitMerge } from 'lucide-react';
import type { MergePlan, MergeRequest } from '@shared/domain/merge';
import { shortBranchName } from '@shared/domain/specs';
import { updateWorkspace } from '../../app/shell/workspaceOperations';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { PathLabel } from '../../components/PathLabel';
import { useShortcut } from '../../lib/useShortcut';
import { Button } from '../../ui/Button';
import { Kbd } from '../../ui/Kbd';
import { useIncomingSummary } from '../incoming/useIncomingSummary';
import { ContributorsDiagram } from './ContributorsDiagram';
import { mergeTitle, mergeTitleText, type MergeTitle } from './mergeDescription';
import type { ConflictLabels } from './resolve/threeWayMerge';
import styles from './MergeHeader.module.css';

interface MergeHeaderProps {
  request: MergeRequest;
  plan: MergePlan;
  labels: ConflictLabels;
  pendingCount: number;
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
  pendingCount,
  intoServerBranch,
  comment,
  onCommentChange,
  canMerge,
  merging,
  onMerge,
}: MergeHeaderProps) {
  useShortcut('mod+enter', onMerge, canMerge);
  const conflictCount = plan.fileConflicts.length + plan.directoryConflicts.length;

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <span className={styles.icon}>
          <GitMerge size={18} />
        </span>
        <div className={styles.titles}>
          <MergeHeading title={mergeTitle(request, labels.destination)} />
          <p className={styles.summary}>{summarize(plan, conflictCount, pendingCount)}</p>
        </div>
        {plan.contributors && <ContributorsDiagram contributors={plan.contributors} sourceName={labels.source} />}
      </div>

      {!intoServerBranch && <BehindHeadNotice />}
      {plan.warnings.map((warning) => (
        <div key={warning} className={styles.notice}>
          <AlertTriangle size={13} />
          {warning}
        </div>
      ))}

      <div className={styles.actions}>
        {intoServerBranch && (
          <input
            className={styles.comment}
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Changeset comment"
            aria-label="Changeset comment"
          />
        )}
        <div className={styles.spacer} />
        <span className={styles.status}>
          {pendingCount > 0 ? `${pendingCount} ${pendingCount === 1 ? 'decision' : 'decisions'} left` : 'Everything is decided'}
        </span>
        {/* The title above names the whole destination; the button keeps its leaf, leaving room for the comment. */}
        <Button variant="primary" size="large" disabled={!canMerge} loading={merging} onClick={onMerge}>
          {intoServerBranch ? `Merge into ${shortBranchName(labels.destination)}` : 'Complete merge'}
          <Kbd keys="mod+enter" />
        </Button>
      </div>
    </header>
  );
}

/** "Merge /main/…/task into /main": each name gives way from its middle, the words around them stay whole. */
function MergeHeading({ title }: { title: MergeTitle }) {
  return (
    <h1 className={styles.title} data-tip={mergeTitleText(title)}>
      {title.verb}
      <PathLabel path={title.source} fitContent tooltip={false} />
      {title.preposition}
      <PathLabel path={title.destination} fitContent tooltip={false} />
    </h1>
  );
}

function summarize(plan: MergePlan, conflictCount: number, pendingCount: number): string {
  const changes = `${plan.changes.length} ${plan.changes.length === 1 ? 'change applies' : 'changes apply'} cleanly`;
  if (conflictCount === 0) return `${changes}. No conflicts.`;
  const conflicts = `${conflictCount} ${conflictCount === 1 ? 'conflict' : 'conflicts'}`;
  return pendingCount === 0 ? `${changes}, ${conflicts} resolved.` : `${changes}, ${conflicts} to review.`;
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
