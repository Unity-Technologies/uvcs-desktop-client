import { useEffect, useMemo, useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import type { DiffTarget } from '@shared/domain/diff';
import { samePlace as isSamePlace, type Place } from '@shared/domain/place';
import { useSession } from '../../../app/workspace/sessionStore';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { EmptyState } from '../../../ui/EmptyState';
import { CenteredSpinner } from '../../../ui/Spinner';
import { openChangesetDiff } from '../../changesets/changesetOperations';
import { useDiffEntries } from '../../diff/useDiffEntries';
import { DiffAnnotationsContext } from '../../diff/viewer/diffAnnotations';
import { FileDiffViewer } from '../../diff/viewer/FileDiffViewer';
import { STEP_FRAME } from '../../diff/viewer/useStepNavigation';
import { ReviewThreadCard } from '../conversation/ReviewThreadCard';
import { useReviewThreads } from '../conversation/useReviewThreads';
import { SHOWN_BY_THE_PAGE } from '../conversation/useReviewConversation';
import { appliedFilesDescription, listsAppliedFiles } from './appliedFiles';
import { AppliedChangesetFiles } from './AppliedChangesetFiles';
import { appliedChangeset, contextDescription, contextTitle, liveThreadOf, type ContextView, type OnScreen } from './commentContext';
import { ContextViewSwitch } from './ContextViewSwitch';
import type { LineThread } from './fileThreads';
import { ContextViewPending } from './ContextViewPending';
import { useContextComparison } from './useContextComparison';
import { useThreadRow } from './useThreadRow';
import styles from './CommentContextDialog.module.css';

export interface CommentInContext {
  /** Where the review is: the dialog closes if the window goes elsewhere while it's open. */
  place: Place;
  review: CodeReview;
  threadId: number;
  user: string | undefined;
  /** The review's repository, which the versions are read in. */
  repository: string;
  /** The file's diff it was opened from; none from the conversation or the Comments panel. */
  onScreen: OnScreen | null;
  /** The view it opens on: what was done since, from a change request's "Applied" pill. */
  startsOn?: ContextView;
  showInConversation: () => void;
}

/** As wide as the window allows, up to this: two versions of code side by side, and the changeset's files beside them. */
const DIALOG_WIDTH = 1680;

/**
 * A thread in context (`commentContext`): the diff it was written on, and what was done to that version since (how a
 * change request was applied), each with the thread at its line; a fix that changed other files too lists them, as a
 * changeset's diff does (`AppliedChangesetFiles`). A dialog, so the review's diff stays as it was.
 */
export function openCommentContextDialog(inContext: CommentInContext): void {
  openDialog((close) => <CommentContextDialog {...inContext} onClose={close} />);
}

export type DialogProps = CommentInContext & { onClose: () => void };

function CommentContextDialog(props: DialogProps) {
  const current = useSession((state) => state.place);
  const samePlace = current !== null && isSamePlace(current, props.place);
  const { onClose } = props;
  useEffect(() => {
    if (!samePlace) onClose();
  }, [samePlace, onClose]);
  return samePlace ? <ThreadInContext {...props} /> : null;
}

/** The thread as the conversation has it now: a reply, an edit or a discard made here shows at once. */
function ThreadInContext(props: DialogProps) {
  const { review, threadId, startsOn = 'commented', onClose } = props;
  const [view, setView] = useState<ContextView>(startsOn);
  // Listing the changeset's files, whether the commented one is selected: its diff alone has the comment's two views.
  const [commentShown, setCommentShown] = useState(true);
  const threads = useReviewThreads(review.id, SHOWN_BY_THE_PAGE);
  const live = liveThreadOf(threads, threadId);
  const appliedIn = live.kind === 'thread' ? appliedChangeset(live.thread) : undefined;
  // The changeset that applied it: the diff "How it was applied" reads anyway (one query), and its files.
  const appliedTarget = useMemo<DiffTarget | null>(() => (appliedIn === undefined ? null : { kind: 'changeset', changesetId: appliedIn }), [appliedIn]);
  const applied = useDiffEntries(appliedTarget);
  if (live.kind !== 'thread') {
    return (
      <Dialog title="Comment" width={DIALOG_WIDTH} onClose={onClose} footer={<CloseButton onClose={onClose} />}>
        <div className={styles.body}>
          <div className={styles.diff}>{live.kind === 'gone' ? <EmptyState title="This comment was deleted" /> : <CenteredSpinner />}</div>
        </div>
      </Dialog>
    );
  }
  const { thread } = live;
  const lists = appliedTarget !== null && listsAppliedFiles(thread, applied.data);
  const showsComment = !lists || commentShown;
  return <ThreadDialog {...props} thread={thread} view={view} onViewChange={setView} lists={lists} showsComment={showsComment} appliedIn={appliedIn} applied={applied} appliedTarget={appliedTarget} onCommentShown={setCommentShown} />;
}

type ThreadDialogProps = DialogProps & {
  thread: LineThread;
  view: ContextView;
  onViewChange: (view: ContextView) => void;
  lists: boolean;
  showsComment: boolean;
  appliedIn: number | undefined;
  applied: ReturnType<typeof useDiffEntries>;
  appliedTarget: DiffTarget | null;
  onCommentShown: (shown: boolean) => void;
};

/** The dialog for a thread there: its view of the file, or of the changeset's files, or the thread alone and why. */
function ThreadDialog(props: ThreadDialogProps) {
  const { thread, view, onViewChange: setView, lists, showsComment, appliedIn, applied, appliedTarget, onCommentShown: setCommentShown, onClose } = props;
  const state = useContextComparison(props);
  const notInChangeset = state.kind === 'notInChangeset';
  return (
    <Dialog
      title={contextTitle(thread)}
      description={showsComment ? contextDescription(thread, view, { fileInChangeset: !notInChangeset }) : appliedFilesDescription(thread)}
      width={DIALOG_WIDTH}
      onClose={onClose}
      // The whole dialog is the diff's (`STEP_FRAME`): ⌥↓ ⌥↑ step through it wherever the focus is in it, the view
      // switch or the dialog itself after a click in the code.
      marks={STEP_FRAME}
      headerAction={showsComment && <ContextViewSwitch thread={thread} view={view} onChange={setView} />}
      footer={
        <>
          {appliedIn !== undefined && (
            <Button
              onClick={() => {
                onClose();
                openChangesetDiff({ id: appliedIn });
              }}
            >
              Open changeset {appliedIn}
            </Button>
          )}
          <CloseButton onClose={onClose} />
        </>
      }
    >
      {notInChangeset ? (
        // No box of code to fill: the thread, and why there's no diff, in what they take.
        <div className={styles.thread}>
          <p className={styles.note}>{state.text}</p>
          <ThreadCard {...props} />
        </div>
      ) : (
        <div className={styles.body}>
          {lists && applied.data && appliedTarget ? (
            <div className={styles.files}>
              <AppliedChangesetFiles {...props} thread={thread} view={view} onCommentShown={setCommentShown} target={appliedTarget} entries={applied.data} />
            </div>
          ) : (
            <div className={styles.diff}>
              <ViewDiff {...props} thread={thread} view={view} />
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** The thread alone, as the code shows it, its first comment's menu leading to the conversation. */
function ThreadCard({ review, thread, user, showInConversation, onClose }: ViewProps) {
  return (
    <ReviewThreadCard
      review={review}
      thread={thread}
      user={user}
      highlight={0}
      inCode={{
        showInConversation: () => {
          onClose();
          showInConversation();
        },
      }}
    />
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="primary" onClick={onClose}>
      Close
    </Button>
  );
}

export type ViewProps = DialogProps & { thread: LineThread; view: ContextView };

/** One view of the commented file alone: its two versions, the thread under its line, scrolled to it. */
function ViewDiff(props: ViewProps) {
  const state = useContextComparison(props);
  const annotations = useThreadRow({ ...props, comparison: state.kind === 'comparison' ? state.comparison : null });
  if (state.kind !== 'comparison') return <ContextViewPending state={state} />;
  // None only without a comparison.
  if (!annotations) return null;
  const { comparison } = state;
  return (
    <DiffAnnotationsContext.Provider key={props.view} value={annotations}>
      <FileDiffViewer place={props.place} original={comparison.original} modified={comparison.modified} fileName={comparison.fileName} />
    </DiffAnnotationsContext.Provider>
  );
}
