import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { pluralize } from '../../../lib/text';
import { ReviewThreadCard, type ThreadInCode } from '../conversation/ReviewThreadCard';
import { earlierTagOf } from './earlierTag';
import type { ContextView } from './commentContext';
import { outdatedOpensFor } from './fileAnnotation';
import type { EarlierThread, LineThread, VersionText } from './fileThreads';
import { snippetOf } from './outdatedSnippet';
import { cardFocusOf } from './threadSelection';
import type { ReviewComments } from './reviewComments';
import { hideLabel, type LineThreads } from './threadRows';
import styles from './InlineThreads.module.css';

interface InlineThreadsProps {
  comments: ReviewComments;
  line: LineThreads;
  focus: ReviewComments['focus'];
  /** Folds the line back into its marker, while comments are hidden in the code. */
  onClose?: () => void;
  onSeeInContext?: SeeInContext;
  /** After the threads: a new comment being written on the line. */
  children?: ReactNode;
}

/** Shows a thread in context, on a view (`ReviewComments.seeInContext`). */
type SeeInContext = (thread: LineThread, startsOn?: ContextView) => void;

/** A row under a line of code, holding the line's threads or a comment being written on it. */
export function ThreadsRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

/** The threads at a line, under it: each as the conversation shows it, without the file it's at. */
export function InlineThreads({ comments, line, focus, onClose, onSeeInContext, children }: InlineThreadsProps) {
  const hide = onClose && { label: hideLabel(line.threads.length), onHide: onClose };
  return (
    <div className={styles.row}>
      {line.threads.map(({ thread, earlier }) => (
        <ThreadInRow
          key={thread.root.id}
          comments={comments}
          thread={thread}
          focus={focus}
          onSeeInContext={onSeeInContext}
          inCode={{
            earlier: earlier && earlierTagOf(thread, false),
            showInConversation: () => comments.showInConversation(thread.root.id),
            seeInContext: earlier && onSeeInContext && (() => onSeeInContext(thread)),
            hide,
          }}
        />
      ))}
      {children}
    </div>
  );
}

interface OutdatedThreadsProps {
  comments: ReviewComments;
  /** The file's outdated threads; while comments are hidden, only those gone to (`openedOutdated`). */
  outdated: readonly EarlierThread[];
  focus: ReviewComments['focus'];
  textOf: (revisionId: number) => VersionText;
  /** Folds one gone to back, while comments are hidden: they show then without the strip that folds them all. */
  onHide?: (thread: LineThread) => void;
  onSeeInContext?: SeeInContext;
}

/**
 * Above the code, the threads written on an earlier version of the file whose lines changed since: folded to one line
 * that says how many, each with the lines it was written on when opened (`snippetOf`), as they're in the code no more.
 * While comments are hidden, only the ones gone to show, each folding back on its own, as a line opened from its marker.
 */
export function OutdatedThreads({ comments, outdated, focus, textOf, onHide, onSeeInContext }: OutdatedThreadsProps) {
  // The time an outdated thread was gone to, which opens them.
  const goneTo = outdatedOpensFor(focus, outdated) ? (focus?.seq ?? null) : null;
  const [open, setOpen] = useState(goneTo !== null);
  const [openedFor, setOpenedFor] = useState(goneTo);
  if (goneTo !== null && openedFor !== goneTo) {
    setOpenedFor(goneTo);
    setOpen(true);
  }
  const cards = outdated.map(({ thread, revisionId }) => (
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
        hide: onHide && { label: hideLabel(1), onHide: () => onHide(thread) },
      }}
    />
  ));
  if (onHide) return <div className={styles.row}>{cards}</div>;
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
        {open && cards}
      </div>
    </div>
  );
}

interface ThreadInRowProps {
  comments: ReviewComments;
  thread: LineThread;
  focus: ReviewComments['focus'];
  inCode: ThreadInCode;
  onSeeInContext?: SeeInContext;
}

/**
 * A thread in the code; its "Applied" pill shows how the change request was applied, in context. Clicked anywhere, or
 * focused (a reply typed, a key's Tab), it's selected (`selectThread`), its controls still doing what they do.
 */
function ThreadInRow({ comments, thread, focus, inCode, onSeeInContext }: ThreadInRowProps) {
  const { highlight, selected } = cardFocusOf(focus, thread.root.id);
  const onSeeApplied = onSeeInContext && (() => onSeeInContext(thread, 'since'));
  const select = (): void => comments.selectThread(thread);
  return (
    <div className={styles.thread} onClickCapture={select} onFocusCapture={select}>
      <ReviewThreadCard review={comments.review} thread={thread} user={comments.user} inCode={inCode} highlight={highlight} selected={selected} onSeeApplied={onSeeApplied} />
    </div>
  );
}

/** The lines an outdated thread was written on, the one it's on marked. */
function Snippet({ text, line }: { text: VersionText; line: number }) {
  const lines = typeof text === 'string' ? snippetOf(text, line) : [];
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
