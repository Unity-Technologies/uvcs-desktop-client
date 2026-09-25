import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Info } from 'lucide-react';
import { useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { MergePlan } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { OptionCards } from '../../ui/OptionCards';
import { Spinner } from '../../ui/Spinner';
import { TextArea } from '../../ui/TextField';
import { pickBranch } from '../branches/BranchPickerDialog';
import { openReview } from '../codeReviews/codeReviewOperations';
import { useReviewsByBranch } from '../codeReviews/useCodeReviews';
import { destinationMovedExplanation, openMerge } from '../merge/mergeOperations';
import { MergeTaskFileList } from './MergeTaskFileList';
import { mergeDestinationIntoTask, mergeTaskOnServer, resolveOnDestination } from './mergeTaskOperations';
import { canMarkReviewed, cleanSummary, countChangesetsToMerge, defaultMergeComment, destinationMoved, mergeTaskOutcome } from './mergeTaskSummary';
import { mergeTaskRequest, useMergeTaskPreview } from './useMergeTaskPreview';
import { ReviewStatusNote } from './ReviewStatusNote';
import styles from './MergeTaskDialog.module.css';

export type MergeTaskBranch = Pick<Branch, 'name' | 'parent' | 'comment'>;

/** Finishes a task branch: merges it to its parent (or another branch) on the server, or shows how to solve its conflicts. */
export function openMergeTaskDialog(workspacePath: string, branch: MergeTaskBranch): void {
  openDialog((close) => <MergeTaskDialog workspacePath={workspacePath} branch={branch} onClose={close} />);
}

type ConflictPath = 'intoTask' | 'onDestination';

function MergeTaskDialog({ workspacePath, branch, onClose }: { workspacePath: string; branch: MergeTaskBranch; onClose: () => void }) {
  const { data: workspace } = useWorkspaceInfo();
  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;
  const [destination, setDestination] = useState(branch.parent);
  // A merge whose destination moved meanwhile leaves its changeset beside the new head; that changeset is merged next.
  const [sourceSpec, setSourceSpec] = useState(spec.branch(branch.name));
  const [notice, setNotice] = useState<string | null>(null);
  const [comment, setComment] = useState(() => defaultMergeComment(branch));
  const [markReviewed, setMarkReviewed] = useState(false);
  const [hideBranch, setHideBranch] = useState(false);
  const [conflictPath, setConflictPath] = useState<ConflictPath>('intoTask');
  const [busy, setBusy] = useState(false);

  const request = mergeTaskRequest(sourceSpec, destination);
  const preview = useMergeTaskPreview(workspacePath, request);
  const review = useReviewsByBranch().data?.get(branch.name);
  const changesetCount = useChangesetsToMerge(workspacePath, branch.name, sourceSpec, preview.data);
  const outcome = preview.data && mergeTaskOutcome(preview.data);
  const fromTaskBranch = sourceSpec === spec.branch(branch.name);
  const path: ConflictPath = fromTaskBranch ? conflictPath : 'onDestination';

  const changeDestination = async (): Promise<void> => {
    const picked = await pickBranch({ title: `Merge ${branch.name} to…`, exclude: branch.name });
    if (!picked) return;
    setDestination(picked);
    setSourceSpec(spec.branch(branch.name));
    setNotice(null);
  };

  const merge = async (): Promise<void> => {
    const reviewed = preview.data;
    if (!reviewed) return;
    setBusy(true);
    try {
      const fresh = (await preview.refetch()).data;
      if (!fresh || destinationMoved(reviewed, fresh)) {
        setNotice(`${destination} got new changesets since the preview. Here is what the merge would do now.`);
        return;
      }
      const result = await mergeTaskOnServer(workspacePath, request, {
        taskBranch: branch.name,
        comment,
        review: markReviewed && canMarkReviewed(review) ? review : undefined,
        hideBranch,
      });
      if (!result) return;
      if (!result.destinationMoved) {
        onClose();
        return;
      }
      setSourceSpec(`cs:${result.changesetId}`);
      setNotice(destinationMovedExplanation(result.changesetId, destination));
    } finally {
      setBusy(false);
    }
  };

  const resolve = (): void => {
    onClose();
    if (path === 'intoTask') void mergeDestinationIntoTask(workspacePath, currentBranch, branch.name, destination);
    else void resolveOnDestination(workspacePath, currentBranch, sourceSpec, destination);
  };

  const keepOneSideOnServer = (): void => {
    onClose();
    openMerge(request);
  };

  return (
    <Dialog
      title={`Merge ${branch.name} to ${destination}`}
      description={
        <span className={styles.destination}>
          The merge happens on the server; your workspace is not touched.
          <button type="button" className={styles.link} onClick={() => void changeDestination()}>
            Change destination
          </button>
        </span>
      }
      width={580}
      onClose={onClose}
      onSubmit={() => (outcome?.kind === 'conflicts' ? resolve() : void merge())}
      footer={
        <>
          <Button onClick={onClose}>{outcome?.kind === 'alreadyMerged' ? 'Close' : 'Cancel'}</Button>
          {outcome?.kind === 'clean' && (
            <Button type="submit" variant="primary" loading={busy} disabled={preview.isFetching}>
              Merge to {destination}
            </Button>
          )}
          {outcome?.kind === 'conflicts' && (
            <Button type="submit" variant="primary">
              {path === 'intoTask' ? `Merge ${destination} into ${branch.name}` : `Resolve on ${destination}`}
            </Button>
          )}
        </>
      }
    >
      {notice && (
        <p className={styles.notice}>
          <Info size={14} />
          <span>{notice}</span>
        </p>
      )}
      {canMarkReviewed(review) && (
        <ReviewStatusNote
          review={review}
          onOpen={() => {
            onClose();
            openReview(review);
          }}
        />
      )}
      {preview.error && <p className={styles.error}>{preview.error.message}</p>}
      {!preview.data && !preview.error && (
        <p className={styles.summary}>
          <Spinner size={14} /> Checking what the merge would do…
        </p>
      )}
      {preview.data && outcome?.kind === 'clean' && (
        <>
          <p className={styles.summary} data-tone="success">
            <CheckCircle2 size={15} />
            {cleanSummary(changesetCount, preview.data.changes.length, destination)}
          </p>
          <MergeTaskFileList plan={preview.data} />
          <TextArea label="Comment" value={comment} onChange={(event) => setComment(event.target.value)} />
          {canMarkReviewed(review) && (
            <Checkbox label={`Mark the code review as reviewed (“${review.title}”)`} checked={markReviewed} onChange={setMarkReviewed} />
          )}
          <Checkbox label="Hide the branch afterwards" checked={hideBranch} onChange={setHideBranch} />
        </>
      )}
      {preview.data && outcome?.kind === 'conflicts' && (
        <>
          <p className={styles.summary} data-tone="conflict">
            <CircleAlert size={15} />
            {outcome.description}
          </p>
          <p className={styles.explanation}>
            {branch.name} and {destination} changed the same files. The server can’t ask you how to combine them, so resolve
            them in your workspace, then merge again.
          </p>
          <MergeTaskFileList plan={preview.data} conflicts />
          {fromTaskBranch && (
            <OptionCards<ConflictPath>
              label="How to resolve them"
              heading
              value={conflictPath}
              onChange={setConflictPath}
              cards={[
                {
                  value: 'intoTask',
                  title: `Merge ${destination} into ${branch.name} first`,
                  description: `Resolve on the task branch${currentBranch === branch.name ? '' : ' (the workspace switches to it)'}, check in, and merge the task again: it will be clean.`,
                },
                {
                  value: 'onDestination',
                  title: `Resolve on ${destination} in this workspace`,
                  description: `${currentBranch === destination ? 'Merge' : `Switch to ${destination} and merge`} ${branch.name} there; checking in finishes the task.`,
                },
              ]}
            />
          )}
          <button type="button" className={styles.link} onClick={keepOneSideOnServer}>
            Or merge on the server, keeping one side for every conflicting file…
          </button>
        </>
      )}
      {preview.data && outcome?.kind === 'alreadyMerged' && (
        <p className={styles.summary} data-tone="success">
          <CheckCircle2 size={15} />
          Nothing to merge: {destination} already has every change of {branch.name}.
        </p>
      )}
      {preview.data && outcome?.kind === 'invalid' && <p className={styles.error}>This merge can’t run.</p>}
    </Dialog>
  );
}

/** How many of the branch's changesets the merge brings; undefined while counting, or when merging a single changeset. */
function useChangesetsToMerge(workspacePath: string, branchName: string, sourceSpec: string, plan: MergePlan | undefined): number | undefined {
  const fromBranch = sourceSpec === spec.branch(branchName);
  const { data: changesets } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'changesets', { branch: branchName }),
    queryFn: () => api.changesets.list(workspacePath, { branch: branchName }),
    enabled: fromBranch,
    refetchOnWindowFocus: false,
  });
  return fromBranch && changesets && plan ? countChangesetsToMerge(changesets, plan, branchName) : undefined;
}
