import { ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { pluralize } from '../../../lib/text';
import { IconButton } from '../../../ui/IconButton';
import { ReviewThreadCard, type ThreadInCode } from '../conversation/ReviewThreadCard';
import { earlierTagOf } from './earlierTag';
import type { EarlierThread, LineThread } from './fileThreads';
import { snippetOf } from './outdatedSnippet';
import type { ReviewComments } from './reviewComments';
import type { LineThreads } from './threadRows';
import styles from './InlineThreads.module.css';

interface InlineThreadsProps {
  comments: ReviewComments;
  line: LineThreads;
  focus: ReviewComments['focus'];
  /** Folds the line back into its marker, while comments are hidden in the code. */
  onClose?: () => void;
  onChangesSince: (revisionId: number) => void;
}

/** The threads at a line, under it: each as the conversation shows it, without the file it's at. */
export function InlineThreads({ comments, line, focus, onClose, onChangesSince }: InlineThreadsProps) {
  return (
    <div className={styles.row}>
      <div className={styles.threads}>
        {line.threads.map(({ thread, earlier }) => (
        <ThreadInRow
          key={thread.root.id}
          comments={comments}
          thread={thread}
          focus={focus}
          inCode={{
            earlier: earlier && earlierTagOf(thread, false),
            showInConversation: () => comments.showInConversation(thread.root.id),
            changesSince: earlier && (() => onChangesSince(earlier.revisionId)),
          }}
        />
        ))}
      </div>
      {onClose && (
        <span className={styles.close}>
          <IconButton size="small" icon={<X size={13} />} label="Hide these comments" onClick={onClose} />
        </span>
      )}
    </div>
  );
}

interface OutdatedThreadsProps {
  comments: ReviewComments;
  outdated: readonly EarlierThread[];
  focus: ReviewComments['focus'];
  textOf: (revisionId: number) => string | undefined;
  onChangesSince: (revisionId: number) => void;
}

/**
 * Above the code, the threads written on an earlier version of the file whose lines changed since: folded to one line
 * that says how many, each with the lines it was written on when opened (`snippetOf`), as they're in the code no more.
 */
export function OutdatedThreads({ comments, outdated, focus, textOf, onChangesSince }: OutdatedThreadsProps) {
  const focusedHere = focus !== null && outdated.some((entry) => entry.thread.root.id === focus.threadId);
  const [open, setOpen] = useState(focusedHere);
  const [openedFor, setOpenedFor] = useState(focusedHere ? focus.seq : null);
  if (focusedHere && openedFor !== focus.seq) {
    setOpenedFor(focus.seq);
    setOpen(true);
  }
  return (
    <div className={styles.row}>
      <div className={styles.outdated}>
        <button
          type="button"
          className={styles.outdatedToggle}
          aria-expanded={open}
          data-tip="Written on an earlier version of this file, on lines changed since"
          onClick={() => setOpen(!open)}
        >
          <ChevronRight size={14} aria-hidden className={styles.chevron} />
          {pluralize(outdated.length, 'outdated comment')}
        </button>
        {open &&
          outdated.map(({ thread, revisionId }) => (
            <ThreadInRow
              key={thread.root.id}
              comments={comments}
              thread={thread}
              focus={focus}
              inCode={{
                earlier: earlierTagOf(thread, true),
                snippet: <Snippet text={textOf(revisionId)} line={thread.root.anchor.line} />,
                showInConversation: () => comments.showInConversation(thread.root.id),
                changesSince: () => onChangesSince(revisionId),
              }}
            />
          ))}
      </div>
    </div>
  );
}

function ThreadInRow({ comments, thread, focus, inCode }: { comments: ReviewComments; thread: LineThread; focus: ReviewComments['focus']; inCode: ThreadInCode }) {
  const highlight = focus?.threadId === thread.root.id ? focus.seq : undefined;
  return <ReviewThreadCard review={comments.review} thread={thread} user={comments.user} inCode={inCode} highlight={highlight} />;
}

/** The lines an outdated thread was written on, the one it's on marked. */
function Snippet({ text, line }: { text: string | undefined; line: number }) {
  const lines = text === undefined ? [] : snippetOf(text, line);
  if (lines.length === 0) return null;
  return (
    <pre className={styles.snippet} aria-label={`Line ${line} as it was`}>
      {lines.map((snippetLine) => (
        <span key={snippetLine.number} className={styles.snippetLine} data-commented={snippetLine.commented || undefined}>
          <span className={styles.snippetNumber}>{snippetLine.number}</span>
          <code>{snippetLine.text}</code>
        </span>
      ))}
    </pre>
  );
}
