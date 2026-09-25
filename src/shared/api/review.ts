import type { ReviewMark } from '../domain/review';

/** Review marks of a workspace's pending changes, checked against the files on disk. */
export interface ReviewApi {
  marks(workspacePath: string): Promise<ReviewMark[]>;
  /** Marks the files as reviewed as they are now, replacing earlier marks. */
  mark(workspacePath: string, paths: string[]): Promise<void>;
  unmark(workspacePath: string, paths: string[]): Promise<void>;
  /** Forgets the marks of every path not in `pendingPaths`: checked in, undone or gone. */
  keepOnly(workspacePath: string, pendingPaths: string[]): Promise<void>;
}
