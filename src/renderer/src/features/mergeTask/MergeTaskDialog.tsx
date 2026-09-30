import { CheckCircle2, Info } from 'lucide-react';
import { useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import { spec } from '@shared/domain/specs';
import { navigation } from '../../app/navigation/navigationStore';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { Spinner } from '../../ui/Spinner';
import { TextArea } from '../../ui/TextField';
import { pickBranch } from '../branches/BranchPickerDialog';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { openReview } from '../codeReviews/codeReviewOperations';
import { useReviewsByBranch } from '../codeReviews/useCodeReviews';
import { destinationMovedExplanation, openMerge } from '../merge/mergeOperations';
import { resolveButtonLabel, type ConflictPath } from './conflictPaths';
import { MergeTaskConflicts } from './MergeTaskConflicts';
import { MergeTaskFileList } from './MergeTaskFileList';
import { mergeDestinationIntoTask, mergeTaskOnServer, resolveOnDestination } from './mergeTaskOperations';
import { canMarkReviewed, cleanSummary, defaultMergeComment, destinationMoved, mergeTaskOutcome } from './mergeTaskSummary';
import { ReviewStatusNote } from './ReviewStatusNote';
import { useChangesetsToMerge } from './useChangesetsToMerge';
import { mergeTaskRequest, useMergeTaskPreview } from './useMergeTaskPreview';
import styles from './MergeTaskDialog.module.css';

export type MergeTaskBranch = Pick<Branch, 'id' | 'name' | 'parent' | 'comment'>;

/** Finishes a task branch: merges it to its parent (or another branch) on the server, or shows how to solve its conflicts. */
export function openMergeTaskDialog(workspacePath: string, branch: MergeTaskBranch): void {
  openDialog((close) => <MergeTaskDialog workspacePath={workspacePath} branch={branch} onClose={close} />);
}

function MergeTaskDialog({ workspacePath, branch, onClose }: { workspacePath: string; branch: MergeTaskBranch; onClose: () => void }) {
  const { data: workspace } = useWorkspaceInfo();
  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;
  const [destination, setDestination] = useState(branch.parent);
  // A merge whose destination moved meanwhile leaves its changeset beside the new head; that changeset is merged next.
  const [nextChangeset, setNextChangeset] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [comment, setComment] = useState(() => defaultMergeComment(branch));
  const [markReviewed, setMarkReviewed] = useState(false);
  const [hideBranch, setHideBranch] = useState(false);
  const [conflictPath, setConflictPath] = useState<ConflictPath>('intoTask');
  const [busy, setBusy] = useState(false);

  const fromTaskBranch = nextChangeset === null;
  const sourceSpec = fromTaskBranch ? spec.branch(branch.name) : spec.changeset(nextChangeset);
  const request = mergeTaskRequest(sourceSpec, destination);
  const preview = useMergeTaskPreview(workspacePath, request);
  const review = useReviewsByBranch().data?.get(branch.id);
  const changesetCount = useChangesetsToMerge(workspacePath, branch.name, fromTaskBranch, preview.data);
  const outcome = preview.data && mergeTaskOutcome(preview.data);
  const path: ConflictPath = fromTaskBranch ? conflictPath : 'onDestination';

  const changeDestination = async (): Promise<void> => {
    const picked = await pickBranch({ title: `Merge ${branch.name} to…`, exclude: branch.name });
    if (!picked) return;
    setDestination(picked);
    setNextChangeset(null);
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
      setNextChangeset(result.changesetId ?? null);
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

  // The diff of what the task brings: the whole branch, or the changeset merged next.
  const openFileDiff = (path: string): void => {
    onClose();
    if (fromTaskBranch) navigation.openPage({ kind: 'diff', title: `Branch ${branch.name}`, target: { kind: 'branch', branch: branch.name }, focusPath: path });
    else openChangesetDiff({ id: nextChangeset }, path);
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
              {resolveButtonLabel(path, branch.name, destination)}
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
          <MergeTaskFileList plan={preview.data} onOpen={openFileDiff} />
          <TextArea label="Comment" value={comment} onChange={(event) => setComment(event.target.value)} />
          {canMarkReviewed(review) && (
            <Checkbox label={`Mark the code review as reviewed (“${review.title}”)`} checked={markReviewed} onChange={setMarkReviewed} />
          )}
          <Checkbox label="Hide the branch afterwards" checked={hideBranch} onChange={setHideBranch} />
        </>
      )}
      {preview.data && outcome?.kind === 'conflicts' && (
        <MergeTaskConflicts
          plan={preview.data}
          description={outcome.description}
          taskBranch={branch.name}
          destination={destination}
          currentBranch={currentBranch}
          conflictPath={fromTaskBranch ? conflictPath : null}
          onConflictPathChange={setConflictPath}
          onOpenFile={openFileDiff}
          onKeepOneSideOnServer={keepOneSideOnServer}
        />
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
