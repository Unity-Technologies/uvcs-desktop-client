import type { DiffLineAnnotation } from '@pierre/diffs';
import { useEffect, useMemo, useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { samePlace as isSamePlace, type Place } from '@shared/domain/place';
import { useSession } from '../../../app/workspace/sessionStore';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { EmptyState } from '../../../ui/EmptyState';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { CenteredSpinner } from '../../../ui/Spinner';
import { openChangesetDiff } from '../../changesets/changesetOperations';
import { useDiffEntries } from '../../diff/useDiffEntries';
import { DiffAnnotationsContext, type DiffAnnotations } from '../../diff/viewer/diffAnnotations';
import { FileDiffViewer } from '../../diff/viewer/FileDiffViewer';
import { STEP_FRAME } from '../../diff/viewer/useStepNavigation';
import { ReviewThreadCard } from '../conversation/ReviewThreadCard';
import { threadsOf } from '../conversation/reviewThreads';
import { useReviewConversation } from '../conversation/useReviewConversation';
import {
  appliedChangeset,
  comparisonOf,
  contextDescription,
  contextEntryOf,
  contextTitle,
  contextViewLabels,
  entryOfThread,
  liveThreadOf,
  type ContextComparison,
  type ContextView,
  type OnScreen,
} from './commentContext';
import type { LineThread } from './fileThreads';
import styles from './CommentContextDialog.module.css';
// The thread's row sets the app's own text back inside Pierre's shadow root, as a row of the review's diff does.
import rowStyles from './InlineThreads.module.css';

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
  /** The view it opens on: what was done since, from a change request's "Applied in". */
  startsOn?: ContextView;
  showInConversation: () => void;
}

const THREAD_ROW = 'thread';

/**
 * A thread in context (`commentContext`): the diff it was written on, and what was done to that version since (how a
 * change request was applied), each with the thread at its line. A dialog, so the review's diff stays as it was.
 */
export function openCommentContextDialog(inContext: CommentInContext): void {
  openDialog((close) => <CommentContextDialog {...inContext} onClose={close} />);
}

type DialogProps = CommentInContext & { onClose: () => void };

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
  const { data: conversation } = useReviewConversation(review.id);
  const threads = useMemo(() => conversation && threadsOf(conversation.comments), [conversation]);
  const live = liveThreadOf(threads, threadId);
  if (live.kind !== 'thread') {
    return (
      <Dialog title="Comment" width={1200} onClose={onClose} footer={<CloseButton onClose={onClose} />}>
        <div className={styles.diff}>{live.kind === 'gone' ? <EmptyState title="This comment was deleted" /> : <CenteredSpinner />}</div>
      </Dialog>
    );
  }
  const { thread } = live;
  const labels = contextViewLabels(thread);
  const appliedIn = appliedChangeset(thread);
  return (
    <Dialog
      title={contextTitle(thread)}
      description={contextDescription(thread, view)}
      width={1200}
      onClose={onClose}
      // The whole dialog is the diff's (`STEP_FRAME`): ⌥↓ ⌥↑ step through it wherever the focus is in it, the view
      // switch or the dialog itself after a click in the code.
      marks={STEP_FRAME}
      headerAction={
        <SegmentedControl<ContextView>
          label="What to show"
          value={view}
          onChange={setView}
          segments={[
            { value: 'commented', label: labels.commented, title: 'The diff the comment was written on' },
            { value: 'since', label: labels.since, title: 'The version commented on, against what it became' },
          ]}
        />
      }
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
      <div className={styles.diff}>
        <ViewDiff {...props} thread={thread} view={view} />
      </div>
    </Dialog>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="primary" onClick={onClose}>
      Close
    </Button>
  );
}

type ViewProps = DialogProps & { thread: LineThread; view: ContextView };

/** One view: the file's entry it compares from (on screen, read, or none needed), then the two versions. */
function ViewDiff(props: ViewProps) {
  const { review, thread, view, onScreen, repository } = props;
  const source = contextEntryOf(review.target, thread, view, onScreen);
  const read = useDiffEntries(source.kind === 'read' ? source.target : null);
  if (source.kind === 'read' && read.error) return <EmptyState title="Couldn't load this diff" description={read.error.message} />;
  if (source.kind === 'read' && !read.data) return <CenteredSpinner />;
  const entry = source.kind === 'onScreen' ? (onScreen?.entry ?? null) : source.kind === 'read' && read.data ? (entryOfThread(read.data, thread) ?? null) : null;
  const comparison = comparisonOf(thread, view, repository, entry);
  if (!comparison) return <EmptyState title="Couldn't find the diff it was written on" />;
  return <ThreadDiff key={view} {...props} comparison={comparison} />;
}

/** Two versions of the file, the thread under its line, scrolled to it. */
function ThreadDiff({ place, review, thread, user, comparison, showInConversation, onClose }: ViewProps & { comparison: ContextComparison }) {
  const { side, line } = comparison;
  // Its own object only when the line changes: a reply made here refreshes the thread, and scrolls nothing.
  const scrollTo = useMemo(() => ({ side, lineNumber: line }), [side, line]);
  const annotations = useMemo<DiffAnnotations>(
    () => ({
      rows: [{ side, lineNumber: line, metadata: THREAD_ROW }],
      render: (_row: DiffLineAnnotation<string>) => (
        <div className={rowStyles.row}>
          <ReviewThreadCard
            review={review}
            thread={thread}
            user={user}
            // What the dialog is about: shown whole, ringed, even when settled (a settled thread starts folded).
            highlight={0}
            inCode={{
              showInConversation: () => {
                onClose();
                showInConversation();
              },
            }}
          />
        </div>
      ),
      markers: [],
      scrollTo,
      opensAtRow: true,
    }),
    [review, thread, user, side, line, scrollTo, showInConversation, onClose],
  );
  return (
    <DiffAnnotationsContext.Provider value={annotations}>
      <FileDiffViewer place={place} original={comparison.original} modified={comparison.modified} fileName={comparison.fileName} />
    </DiffAnnotationsContext.Provider>
  );
}
