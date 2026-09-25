/**
 * A file marked as reviewed in pending changes. The mark remembers the file's contents at that moment, so it can tell
 * when the file changed since (e.g. an agent edited it again).
 */
export interface ReviewMark {
  path: string;
  state: 'reviewed' | 'changedSinceReview';
  /** A copy of the reviewed text was kept, so the changes since the review can be shown. */
  hasSnapshot: boolean;
}
