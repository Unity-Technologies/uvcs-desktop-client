import { useQuery } from '@tanstack/react-query';
import { ArrowRight, GitPullRequestDraft } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Place } from '@shared/domain/place';
import { usePlaceUser } from '../../app/account/accounts';
import { navigation } from '../../app/navigation/navigationStore';
import { queryClient, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { CommentArea } from '../../components/commentEditor/CommentArea';
import { oneLineText } from '../../components/commentEditor/commentFieldText';
import { CommentFocusGroup } from '../../components/commentEditor/CommentFocusGroup';
import { DESCRIPTION_PLACEHOLDER } from '../../components/commentEditor/commentPlaceholders';
import { useSettledValue } from '../../lib/useSettled';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { SplitButton } from '../../ui/SplitButton';
import { branchQuery } from '../branches/useBranches';
import { branchReviewsQuery } from './changeRequests/useChangeRequests';
import { BranchField } from './BranchField';
import { destinationGroups } from './destinationChoices';
import { createMergeRequest } from './mergeRequestCreation';
import { blocksCreate, existingRequestOf, mergeRequestForm, reviewsCheckOf, sourceGroups } from './mergeRequestDraft';
import { DraftNoteLine } from './DraftNoteLine';
import { chooseReviewers, reviewersShown, reviewersToAsk, startingReviewers, type ChosenReviewers } from './pickedReviewers';
import { ReviewersField } from './ReviewersField';
import styles from './CreateMergeRequestDialog.module.css';

/** A branch as the dialog starts on it: a menu's holds its comment and parent, so the dialog needn't read it. */
export type MergeRequestSource = string | Pick<Branch, 'name' | 'comment' | 'parent' | 'owner'>;

/**
 * Opens the "new merge request" dialog (docs/features/merge-requests.md "Creating one"), on `source` when one is given
 * (a branch's menu, the workspace's branch); `onCreated` gets the new request's id.
 */
export function openCreateMergeRequestDialog(place: Place, source?: MergeRequestSource, onCreated?: (reviewId: number) => void): void {
  openDialog((close) => <CreateMergeRequestDialog place={place} initialSource={sourceOf(source)} onClose={close} onCreated={onCreated} />);
}

/** The branch the dialog is on: its name, and its comment, parent and owner where known (a pick from a branch list). */
interface PickedSource {
  name: string;
  branch?: Pick<Branch, 'comment' | 'parent' | 'owner'>;
}

function sourceOf(source: MergeRequestSource | undefined): PickedSource {
  if (source === undefined) return { name: '' };
  return typeof source === 'string' ? { name: source } : { name: source.name, branch: source };
}

interface CreateMergeRequestDialogProps {
  place: Place;
  initialSource: PickedSource;
  onClose: () => void;
  onCreated?: (reviewId: number) => void;
}

function CreateMergeRequestDialog({ place, initialSource, onClose, onCreated }: CreateMergeRequestDialogProps) {
  const you = usePlaceUser();
  const [source, setSource] = useState(initialSource);
  const [picked, setPicked] = useState<string>();
  const [typed, setTyped] = useState<string>();
  const [description, setDescription] = useState('');
  // Until the user changes who is asked, the reviewers follow the branch picked: you, on someone else's.
  const [chosenReviewers, setChosenReviewers] = useState<ChosenReviewers>();
  const [creating, setCreating] = useState(false);

  // A branch named alone (the workspace's) is read for its comment and parent: two light `cm find branch`, often read
  // already (the top bar's). A pick from a branch list holds them.
  const { data: readBranch } = useQuery({ ...branchQuery(place, source.name), ...SLOW_CHANGING_QUERY, enabled: source.name !== '' && !source.branch });
  // The branch's reviews, once a pick settles: the read Changes and the top bar share (`branchReviewsKey`).
  const settledSource = useSettledValue(source.name, source.name);
  const reviewsRead = useQuery({ ...branchReviewsQuery(place, settledSource), enabled: settledSource !== '' && settledSource === source.name });
  // Only the reviews of the branch now picked: while a new pick settles, the query still holds the last one's.
  const reviewsOfBranch = settledSource === source.name ? reviewsRead.data : undefined;
  const reviewsCheck = reviewsCheckOf(source.name, reviewsOfBranch, settledSource === source.name && reviewsRead.isError);

  const sourceBranch = source.branch ?? readBranch ?? undefined;
  const branchReviewers = startingReviewers(you, sourceBranch?.owner);
  const reviewers = reviewersShown(chosenReviewers, branchReviewers);
  const { destination, title, note, problem, tip } = mergeRequestForm({ source: source.name, sourceBranch, picked, typed, reviewsOfBranch, reviewsCheck });

  const sourceChoices = useCallback((branches: Branch[]) => sourceGroups(branches), []);
  const destinationChoices = useCallback((branches: Branch[]) => destinationGroups(branches, source.name, sourceBranch?.parent), [source.name, sourceBranch?.parent]);

  const create = async (draft: boolean): Promise<void> => {
    if (problem || creating) return;
    setCreating(true);
    // A pick not settled yet still waits for the branch's reviews: never a second request into the same branch.
    if (blocksCreate(existingRequestOf(await reviewsOf(place, source.name), destination))) {
      setCreating(false);
      return;
    }
    const request = { source: source.name, destination, title: title.trim(), description: description.trim() || undefined, draft, reviewers: reviewersToAsk(reviewers) };
    const reviewId = await createMergeRequest(place, request, (id) => {
      onClose();
      onCreated?.(id);
    });
    if (reviewId === undefined) setCreating(false);
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
            onClick={() => void create(false)}
            loading={creating}
            disabled={problem !== undefined}
            tip={tip}
            menuLabel="Other ways to create it"
            menu={[{ id: 'createDraft', label: 'Create as draft', description: "Can't be merged until it's ready for review", icon: GitPullRequestDraft, run: () => void create(true) }]}
          >
            Create merge request
          </SplitButton>
        </>
      }
    >
      <div className={styles.branches}>
        <div className={styles.branch}>
          <BranchField
            onLeave={onClose}
            place={place}
            label="From"
            value={source.name || undefined}
            placeholder="Pick a branch"
            groupsOf={sourceChoices}
            searchPlaceholder="Merge the branch…"
            onPick={(branch) => setSource({ name: branch.name, branch })}
          />
        </div>
        <ArrowRight size={14} className={styles.arrow} aria-hidden />
        <div className={styles.branch}>
          <BranchField
            onLeave={onClose}
            place={place}
            label="Into"
            value={destination || undefined}
            placeholder="Pick a destination"
            groupsOf={destinationChoices}
            searchPlaceholder="Merge into…"
            onPick={(branch) => setPicked(branch.name)}
          />
        </div>
      </div>
      {note && <DraftNoteLine note={note} onOpen={openExisting} />}
      {/* One focus mode for both; Enter in the title creates the request, as in the code review's dialog. */}
      <CommentFocusGroup>
        <CommentArea
          singleLine
          label="Title"
          groupField="summary"
          placeholder="What does it change?"
          value={title}
          onChange={(text) => setTyped(oneLineText(text))}
          autoFocus
        />
        <CommentArea
          label="Description"
          tall
          groupField="description"
          placeholder={DESCRIPTION_PLACEHOLDER}
          value={description}
          onChange={setDescription}
        />
      </CommentFocusGroup>
      <ReviewersField pick={reviewers} onPickChange={(next) => setChosenReviewers(chooseReviewers(chosenReviewers, branchReviewers, next))} />
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
