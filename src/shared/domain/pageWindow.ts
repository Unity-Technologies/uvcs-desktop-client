import type { DiffEntry, DiffTarget } from './diff';

/**
 * The renderer's page (`Page`: a diff, a file's history, a code review…) as plain data. The main process only carries
 * it, from the window that opens it to the page window that shows it and from a window's selection to the page window
 * following it; the renderer checks what it gets back (`asMovablePage`).
 */
export type PageWindowPage = { kind: string } & Record<string, unknown>;

/**
 * A page of a workspace opened in a window of its own (`windows.openPage`), beside the workspace's window, which it
 * belongs to: it closes with it, or once it leaves the workspace.
 */
export interface PageWindowOpening {
  workspacePath: string;
  page: PageWindowPage;
  /**
   * The diff the page shows, already read where it opened: the page window's first read of it takes these instead of
   * asking `cm diff` again (`HandedOverDiffs`).
   */
  diff?: { target: DiffTarget; entries: DiffEntry[] };
}
