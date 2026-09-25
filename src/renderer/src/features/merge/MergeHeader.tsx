import { AlertTriangle, ArrowDownToLine, Eye, GitMerge } from 'lucide-react';
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
import { mergeTitle, mergeTitleText, type MergeLabels, type MergeTitle } from './mergeDescription';
import styles from './MergeHeader.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

interface MergeHeaderProps {
  request: MergeRequest;
  plan: MergePlan;
  labels: MergeLabels;
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
  summary,
  intoServerBranch,
  comment,
  onCommentChange,
  canMerge,
  merging,
  onMerge,
}: MergeHeaderProps) {
  useShortcut(hotkey('merge'), onMerge, canMerge);
  const hasConflicts = plan.fileConflicts.length + plan.directoryConflicts.length > 0;

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <span className={styles.icon}>
          <GitMerge size={18} />
        </span>
        <div className={styles.titles}>
          <div className={styles.titleRow}>
            <span className={styles.preview} data-tip={previewExplanation(intoServerBranch, labels.destination)}>
              <Eye size={12} />
              Preview
            </span>
            <MergeHeading title={mergeTitle(request, labels.destination)} />
          </div>
          <p className={styles.guidance}>{guidance(hasConflicts, intoServerBranch)}</p>
        </div>
        {plan.contributors && <ContributorsDiagram contributors={plan.contributors} labels={labels} intoServerBranch={intoServerBranch} />}
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
        <span className={styles.status}>{summary}</span>
        {/* The title above names the whole destination; the button keeps its leaf, leaving room for the comment. */}
        <Button variant="primary" size="large" disabled={!canMerge} loading={merging} onClick={onMerge}>
          {intoServerBranch ? `Merge into ${shortBranchName(labels.destination)}` : 'Complete merge'}
          <Kbd keys={hotkey('merge')} />
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

/** The one thing to know before anything else: nothing happened yet, and what to do about it. */
function guidance(hasConflicts: boolean, intoServerBranch: boolean): string {
  const review = hasConflicts ? 'Review the plan, decide the conflicts' : 'Review the plan';
  return intoServerBranch ? `Nothing has changed yet. ${review}, then merge to create the changeset.` : `Nothing has changed yet. ${review}, then Complete merge.`;
}

function previewExplanation(intoServerBranch: boolean, destination: string): string {
  return intoServerBranch
    ? `A preview: the merge is worked out but not run. Merging creates a changeset on ${destination}.`
    : 'A preview: the merge is worked out but not applied. Complete merge writes the result to your workspace as pending changes, which you check in afterwards.';
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
