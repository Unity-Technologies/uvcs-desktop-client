import { AlertTriangle, ArrowDownToLine, Eye } from 'lucide-react';
import { useMemo, type ReactNode, type Ref } from 'react';
import type { MergePlan, MergeRequest } from '@shared/domain/merge';
import { shortBranchName } from '@shared/domain/specs';
import { updateWorkspace } from '../../app/shell/workspaceOperations';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { hotkey } from '../../lib/shortcutRegistry';
import { pluralize } from '../../lib/text';
import { useShortcut } from '../../lib/useShortcut';
import { Button } from '../../ui/Button';
import { Kbd } from '../../ui/Kbd';
import { useIncomingSummary } from '../incoming/useIncomingSummary';
import { MergeContributors } from './MergeContributors';
import { mergeTitle, type MergeLabels } from './mergeDescription';
import { MergeHeading } from './MergeHeading';
import styles from './MergeHeader.module.css';

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
  /**
   * Resolving the files one by one in a merge tool: the offer, the primary action while it shows, or the run under
   * way, which takes the status's place.
   */
  run?: { control: ReactNode; running: boolean };
  /** What else the merge does once it's in, under the comment (finishing a task: `TaskMergeOptions`). */
  options?: ReactNode;
  mergeButtonRef?: Ref<HTMLButtonElement>;
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
  run,
  options,
  mergeButtonRef,
}: MergeHeaderProps) {
  useShortcut(hotkey('merge'), onMerge, canMerge);
  // Stable while the request is, so the title is fitted again only when it changes or its room does.
  const title = useMemo(() => mergeTitle(request, labels.destination), [request, labels.destination]);

  // The page's final action, so it keeps its primary look, faded until every conflict is decided; it steps back while
  // resolving them one by one is the way forward.
  const mergeButton = (
    <Button ref={mergeButtonRef} variant={run?.control && !canMerge ? 'secondary' : 'primary'} disabled={!canMerge} loading={merging} onClick={onMerge}>
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
        {plan.contributors && (
          <span className={styles.contributors}>
            <MergeContributors contributors={plan.contributors} labels={labels} />
          </span>
        )}
        {!run?.running && (
          <span className={styles.status} data-tip={summary}>
            {progress}
          </span>
        )}
        {run?.control}
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
      {intoServerBranch && options}

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

/** Merging into an outdated workspace works, but checking in the result will need an update first. */
function BehindHeadNotice() {
  const workspacePath = useWorkspacePath();
  const { data: incoming } = useIncomingSummary();
  if (!incoming?.changesetCount) return null;

  return (
    <div className={styles.notice}>
      <ArrowDownToLine size={13} />
      Your workspace is {pluralize(incoming.changesetCount, 'changeset')} behind {incoming.branch}. Update first
      to merge into the latest version.
      <Button size="small" onClick={() => void updateWorkspace(workspacePath)}>
        Update
      </Button>
    </div>
  );
}
