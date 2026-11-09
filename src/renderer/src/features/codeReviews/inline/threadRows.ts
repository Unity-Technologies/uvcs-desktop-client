import type { ReviewCommentKind } from '@shared/domain/reviewConversation';
import type { PlacedThread, ThreadSide } from './fileThreads';

/** The threads at one line of one side of a diff: one row under the line, or one marker on it. */
export interface LineThreads {
  /** Names the line among the file's: what stays open across renders. */
  key: string;
  side: ThreadSide;
  line: number;
  /** Oldest first, as they were started. */
  threads: PlacedThread[];
}

/** The placed threads by line, each line once, the older side's first and then by line, as the diff reads. */
export function lineThreadsOf(placed: readonly PlacedThread[]): LineThreads[] {
  const byLine = new Map<string, LineThreads>();
  for (const entry of placed) {
    const key = lineKey(entry.side, entry.line);
    const row = byLine.get(key) ?? { key, side: entry.side, line: entry.line, threads: [] };
    row.threads.push(entry);
    byLine.set(key, row);
  }
  for (const row of byLine.values()) row.threads.sort((a, b) => Date.parse(a.thread.root.date) - Date.parse(b.thread.root.date) || a.thread.root.id - b.thread.root.id);
  return [...byLine.values()].sort((a, b) => sideOrder(a.side) - sideOrder(b.side) || a.line - b.line);
}

export function lineKey(side: ThreadSide, line: number): string {
  return `${side}:${line}`;
}

/** What the code shows of a file's threads: rows under their lines, and a marker on each line whose threads are folded away. */
export interface ShownThreadRows {
  rows: LineThreads[];
  markers: LineThreads[];
}

/**
 * With comments in the code, every line's threads show under it. Hidden, the code reads uninterrupted: each line with
 * threads has a marker, and only the lines opened from one (or the thread gone to) show theirs, in the order they were
 * opened (see `annotationRowsOf` for why the order matters).
 */
export function shownThreadRows(lines: readonly LineThreads[], inCode: boolean, opened: readonly string[]): ShownThreadRows {
  if (inCode) return { rows: [...lines], markers: [] };
  const rows = opened.map((key) => lines.find((line) => line.key === key)).filter((line): line is LineThreads => line !== undefined);
  return { rows, markers: lines.filter((line) => !opened.includes(line.key)) };
}

/** The line holding a thread, to scroll to it; none when the file shows it at no line. */
export function lineOfThread(lines: readonly LineThreads[], commentId: number): LineThreads | undefined {
  return lines.find((line) => line.threads.some((entry) => entry.thread.root.id === commentId));
}

/** What a marker says of a line's threads: one names its kind, several how many. */
export function markerLabel(line: Pick<LineThreads, 'threads' | 'line'>): string {
  const count = line.threads.length;
  const what = count === 1 ? KIND_WORDS[line.threads[0]!.thread.root.kind] : `${count} comments`;
  return `${what} on line ${line.line}`;
}

const KIND_WORDS: Record<ReviewCommentKind, string> = {
  changeRequest: 'Change request',
  question: 'Question',
  comment: 'Comment',
  general: 'Comment',
  discard: 'Comment',
};

/** A marker stands out while anything on its line is still open (a change request to apply, a question to answer). */
export function markerIsOpen(line: Pick<LineThreads, 'threads'>): boolean {
  return line.threads.some((entry) => entry.thread.state.kind === 'open');
}

function sideOrder(side: ThreadSide): number {
  return side === 'deletions' ? 0 : 1;
}
