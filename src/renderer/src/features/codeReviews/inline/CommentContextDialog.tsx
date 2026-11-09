import type { DiffLineAnnotation } from '@pierre/diffs';
import { useMemo, useState } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { openDialog } from '../../../ui/dialog/dialogStore';
import { EmptyState } from '../../../ui/EmptyState';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { CenteredSpinner } from '../../../ui/Spinner';
import { useDiffEntries } from '../../diff/useDiffEntries';
import { DiffAnnotationsContext, type DiffAnnotations } from '../../diff/viewer/diffAnnotations';
import { FileDiffViewer } from '../../diff/viewer/FileDiffViewer';
import { ReviewThreadCard } from '../conversation/ReviewThreadCard';
import { commentedComparison, contextDescription, contextViewLabels, sinceComparison, writtenDiffToRead, writtenEntryOf, type ContextComparison, type ContextView, type ShownEntry } from './commentContext';
import type { LineThread, ReviewDiffView } from './fileThreads';
import styles from './CommentContextDialog.module.css';
// The thread's row sets the app's own text back inside Pierre's shadow root, as a row of the review's diff does.
import rowStyles from './InlineThreads.module.css';

interface CommentInContext {
  review: CodeReview;
  thread: LineThread;
  user: string | undefined;
  /** The file as the diff on screen shows it, and which of the review's diffs that is. */
  shown: ShownEntry;
  view: ReviewDiffView;
  showInConversation: () => void;
}

const THREAD_ROW = 'thread';

/**
 * A thread written on an earlier version of a file, in context (`commentContext`): the diff it was written on, and what
 * was done to that version since, each with the thread at its line. A dialog, so the review's diff stays as it was.
 */
export function openCommentContextDialog(inContext: CommentInContext): void {
  openDialog((close) => <CommentContextDialog {...inContext} onClose={close} />);
}

function CommentContextDialog({ onClose, ...inContext }: CommentInContext & { onClose: () => void }) {
  const { thread } = inContext;
  const [view, setView] = useState<ContextView>('commented');
  const labels = contextViewLabels(thread);
  return (
    <Dialog
      title={`${thread.root.anchor.path.replace(/^.*\//, '')}, line ${thread.root.anchor.line}`}
      description={contextDescription(thread, view)}
      width={1200}
      onClose={onClose}
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
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className={styles.diff}>
        {view === 'commented' ? <CommentedDiff {...inContext} onClose={onClose} /> : <ThreadDiff {...inContext} comparison={sinceComparison(thread, inContext.shown)} onClose={onClose} />}
      </div>
    </Dialog>
  );
}

type ViewProps = CommentInContext & { onClose: () => void };

/** The diff the thread was written on: the one on screen, or its changeset's, read when another is on screen. */
function CommentedDiff(props: ViewProps) {
  const { review, thread, view, shown } = props;
  const changesetToRead = writtenDiffToRead(review.target, thread, view);
  const written = useDiffEntries(changesetToRead === null ? null : { kind: 'changeset', changesetId: changesetToRead });
  if (changesetToRead === null) return <ThreadDiff {...props} comparison={commentedComparison(thread, shown)} />;
  if (written.error) return <EmptyState title="Couldn't load this diff" description={written.error.message} />;
  if (!written.data) return <CenteredSpinner />;
  const entry = writtenEntryOf(written.data, thread);
  if (!entry) return <EmptyState title="The file isn't in that changeset's diff" />;
  return <ThreadDiff {...props} comparison={commentedComparison(thread, entry)} />;
}

/** Two versions of the file, the thread under its line, scrolled to it. */
function ThreadDiff({ review, thread, user, comparison, showInConversation, onClose }: ViewProps & { comparison: ContextComparison }) {
  const place = usePlace();
  const { side, line } = comparison;
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
      scrollTo: { side, lineNumber: line },
      opensAtRow: true,
    }),
    [review, thread, user, side, line, showInConversation, onClose],
  );
  const fileName = thread.root.anchor.path.replace(/^\//, '');
  return (
    <DiffAnnotationsContext.Provider value={annotations}>
      <FileDiffViewer place={place} original={comparison.original} modified={comparison.modified} fileName={fileName} />
    </DiffAnnotationsContext.Provider>
  );
}
