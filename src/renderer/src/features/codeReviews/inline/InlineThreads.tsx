import { ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { pluralize } from '../../../lib/text';
import { IconButton } from '../../../ui/IconButton';
import { ReviewThreadCard, type ThreadInCode } from '../conversation/ReviewThreadCard';
import { earlierTagOf } from './earlierTag';
import type { ContextView } from './commentContext';
import { offersContext, outdatedOpensFor } from './fileAnnotation';
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
  onSeeInContext?: SeeInContext;
}

/** Shows a thread in context, on a view (`ReviewComments.seeInContext`). */
type SeeInContext = (thread: LineThread, startsOn?: ContextView) => void;

/** The threads at a line, under it: each as the conversation shows it, without the file it's at. */
export function InlineThreads({ comments, line, focus, onClose, onSeeInContext }: InlineThreadsProps) {
  return (
    <div className={styles.row}>
      <div className={styles.threads}>
        {line.threads.map((placed) => {
          const { thread, earlier } = placed;
          const offered = offersContext(placed) ? onSeeInContext : undefined;
          return (
        <ThreadInRow
          key={thread.root.id}
          comments={comments}
          thread={thread}
          focus={focus}
          onSeeInContext={onSeeInContext}
          inCode={{
            earlier: earlier && earlierTagOf(thread, false),
            showInConversation: () => comments.showInConversation(thread.root.id),
            seeInContext: offered && (() => offered(thread)),
          }}
        />
          );
        })}
      </div>
      {onClose && <CloseButton label="Hide these comments" onClose={onClose} />}
    </div>
  );
}

interface OutdatedThreadsProps {
  comments: ReviewComments;
  outdated: readonly EarlierThread[];
  focus: ReviewComments['focus'];
  textOf: (revisionId: number) => string | undefined;
  /** Hides them again, while comments are hidden in the code: they showed because one of them was gone to. */
  onClose?: () => void;
  onSeeInContext?: SeeInContext;
}

/**
 * Above the code, the threads written on an earlier version of the file whose lines changed since: folded to one line
 * that says how many, each with the lines it was written on when opened (`snippetOf`), as they're in the code no more.
 */
export function OutdatedThreads({ comments, outdated, focus, textOf, onClose, onSeeInContext }: OutdatedThreadsProps) {
  // The time an outdated thread was gone to, which opens them.
  const goneTo = outdatedOpensFor(focus, outdated) ? (focus?.seq ?? null) : null;
  const [open, setOpen] = useState(goneTo !== null);
  const [openedFor, setOpenedFor] = useState(goneTo);
  if (goneTo !== null && openedFor !== goneTo) {
    setOpenedFor(goneTo);
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
              onSeeInContext={onSeeInContext}
              inCode={{
                earlier: earlierTagOf(thread, true),
                snippet: <Snippet text={textOf(revisionId)} line={thread.root.anchor.line} />,
                showInConversation: () => comments.showInConversation(thread.root.id),
                seeInContext: onSeeInContext && (() => onSeeInContext(thread)),
              }}
            />
          ))}
      </div>
      {onClose && <CloseButton label="Hide the outdated comments" onClose={onClose} />}
    </div>
  );
}

function CloseButton({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <span className={styles.close}>
      <IconButton size="small" icon={<X size={13} />} label={label} onClick={onClose} />
    </span>
  );
}

interface ThreadInRowProps {
  comments: ReviewComments;
  thread: LineThread;
  focus: ReviewComments['focus'];
  inCode: ThreadInCode;
  onSeeInContext?: SeeInContext;
}

/** A thread in the code; its "Applied in" shows how the change request was applied, in context. */
function ThreadInRow({ comments, thread, focus, inCode, onSeeInContext }: ThreadInRowProps) {
  const highlight = focus?.threadId === thread.root.id ? focus.seq : undefined;
  const onSeeApplied = onSeeInContext && (() => onSeeInContext(thread, 'since'));
  return <ReviewThreadCard review={comments.review} thread={thread} user={comments.user} inCode={inCode} highlight={highlight} onSeeApplied={onSeeApplied} />;
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
