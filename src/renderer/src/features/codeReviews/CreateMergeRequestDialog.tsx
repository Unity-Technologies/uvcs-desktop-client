import { useQuery } from '@tanstack/react-query';
import { ArrowRight, GitPullRequestDraft } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { navigation } from '../../app/navigation/navigationStore';
import { queryClient, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { CommentArea } from '../../components/commentEditor/CommentArea';
import { oneLineText } from '../../components/commentEditor/commentFieldText';
import { useSettledValue } from '../../lib/useSettled';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { SplitButton } from '../../ui/SplitButton';
import { TextField } from '../../ui/TextField';
import { branchQuery } from '../branches/useBranches';
import { branchReviewsQuery } from './changeRequests/useChangeRequests';
import { BranchField } from './BranchField';
import { destinationGroups } from './destinationChoices';
import { createMergeRequest } from './mergeRequestCreation';
import { defaultDestinationOf, defaultTitleOf, draftProblem, existingRequestNote, existingRequestOf, sourceGroups } from './mergeRequestDraft';
import { typedReviewers } from './reviewerGroups';
import { useReviewerGroups } from './useReviewerGroups';
import styles from './CreateMergeRequestDialog.module.css';

/**
 * Opens the "new merge request" dialog (docs/features/merge-requests.md "Creating one"), on `branchName` when one is
 * given (a branch's menu, the workspace's branch); `onCreated` gets the new request's id.
 */
export function openCreateMergeRequestDialog(place: Place, branchName?: string, onCreated?: (reviewId: number) => void): void {
  openDialog((close) => <CreateMergeRequestDialog place={place} initialSource={branchName ?? ''} onClose={close} onCreated={onCreated} />);
}

interface CreateMergeRequestDialogProps {
  place: Place;
  initialSource: string;
  onClose: () => void;
  onCreated?: (reviewId: number) => void;
}

function CreateMergeRequestDialog({ place, initialSource, onClose, onCreated }: CreateMergeRequestDialogProps) {
  const [source, setSource] = useState(initialSource);
  // Picked by the user; until then it follows the branch (`defaultDestinationOf`), as the title does.
  const [pickedDestination, setPickedDestination] = useState<string>();
  const [typedTitle, setTypedTitle] = useState<string>();
  const [description, setDescription] = useState('');
  const [reviewers, setReviewers] = useState('');
  const [creating, setCreating] = useState(false);
  const groups = useReviewerGroups();

  // Its comment, for the title, and its parent: one light `cm find branch`, often read already (the top bar's).
  const { data: sourceBranch } = useQuery({ ...branchQuery(place, source), ...SLOW_CHANGING_QUERY, enabled: source !== '' });
  // The branch's reviews, once a pick settles: the read Changes and the top bar share (`branchReviewsKey`).
  const settledSource = useSettledValue(source, source);
  const { data: reviewsOfBranch } = useQuery({ ...branchReviewsQuery(place, settledSource), enabled: settledSource !== '' && settledSource === source });

  const destination = pickedDestination ?? defaultDestinationOf(source, sourceBranch?.parent) ?? '';
  const title = typedTitle ?? defaultTitleOf(source, sourceBranch?.comment);
  const existing = reviewsOfBranch && existingRequestOf(reviewsOfBranch, destination);
  const note = existing && existingRequestNote(existing);
  const problem = draftProblem({ source, sourceParent: sourceBranch?.parent, destination, title }) ?? note?.blocks;

  const sourceChoices = useCallback((branches: Branch[]) => sourceGroups(branches), []);
  const destinationChoices = useCallback((branches: Branch[]) => destinationGroups(branches, source), [source]);

  const create = async (draft: boolean): Promise<void> => {
    if (problem || creating) return;
    setCreating(true);
    // A pick not settled yet still waits for the branch's reviews: never a second request into the same branch.
    if (existingRequestOf(await reviewsOf(place, source), destination)?.kind === 'active') {
      setCreating(false);
      return;
    }
    const reviewId = await createMergeRequest(place, {
      source,
      destination,
      title: title.trim(),
      description: description.trim() || undefined,
      draft,
      reviewers: typedReviewers(reviewers, groups),
    });
    setCreating(false);
    if (reviewId === undefined) return;
    onClose();
    onCreated?.(reviewId);
  };

  const openExisting = (review: CodeReviewSummary): void => {
    onClose();
    navigation.openPage({ kind: 'codeReview', reviewId: review.id });
  };

  return (
    <Dialog
      title="New merge request"
      description="Ask to merge a branch once it's reviewed."
      width={560}
      onClose={onClose}
      onSubmit={() => void create(false)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <SplitButton
            variant="primary"
            size="medium"
            onClick={() => void create(false)}
            loading={creating}
            disabled={problem !== undefined}
            tip={problem}
            menuLabel="Other ways to create it"
            menu={[{ id: 'createDraft', label: 'Create as draft', icon: GitPullRequestDraft, run: () => void create(true) }]}
          >
            Create merge request
          </SplitButton>
        </>
      }
    >
      <div className={styles.branches}>
        <div className={styles.branch}>
          <BranchField
            place={place}
            label="From"
            value={source || undefined}
            placeholder="Pick a branch"
            groupsOf={sourceChoices}
            searchPlaceholder="Merge the branch…"
            onPick={(branch) => setSource(branch.name)}
          />
        </div>
        <ArrowRight size={14} className={styles.arrow} aria-hidden />
        <div className={styles.branch}>
          <BranchField
            place={place}
            label="Into"
            value={destination || undefined}
            placeholder="Pick a destination"
            groupsOf={destinationChoices}
            searchPlaceholder="Merge into…"
            onPick={(branch) => setPickedDestination(branch.name)}
          />
        </div>
      </div>
      {note && existing && (
        <p className={note.request ? styles.note : styles.quietNote}>
          {note.text}
          {note.request && (
            <>
              {' '}
              <span className={styles.request}>{note.request}</span>
              <button type="button" className={styles.openIt} onClick={() => openExisting(existing.review)}>
                Open it
              </button>
            </>
          )}
        </p>
      )}
      {/* A title is one line: Enter creates the request, as in the code review's dialog. */}
      <CommentArea singleLine label="Title" placeholder="What does it change?" value={title} onChange={(text) => setTypedTitle(oneLineText(text))} autoFocus />
      <CommentArea label="Description" placeholder="Give an overview, or instructions for the reviewers. Optional." value={description} onChange={setDescription} />
      <TextField
        label="Reviewers"
        placeholder="jane.doe@example.com, john.doe@example.com"
        hint="Optional. You can add them later."
        value={reviewers}
        onChange={(event) => setReviewers(event.target.value)}
      />
    </Dialog>
  );
}

/** The branch's reviews as read, or read now if they aren't yet; none if they can't be, which never stops a create. */
async function reviewsOf(place: Place, branch: string): Promise<CodeReviewSummary[]> {
  try {
    return await queryClient.fetchQuery(branchReviewsQuery(place, branch));
  } catch {
    return [];
  }
}
