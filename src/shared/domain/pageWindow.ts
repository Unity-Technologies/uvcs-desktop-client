import type { Place } from './place';
import type { Changeset } from './changeset';
import type { DiffEntry, DiffTarget } from './diff';
import type { Shelve } from './shelve';

/**
 * The renderer's page (`Page`: a diff, a file's history, a code review…) as plain data. The main process only carries
 * it, from the window that opens it to the page window that shows it and from a window's selection to the page window
 * following it; the renderer checks what it gets back (`asMovablePage`).
 */
export type PageWindowPage = { kind: string } & Record<string, unknown>;

/**
 * The object a page shows, from a list the window it came from already read (`readAt`, when it read it): a page
 * window starts with it instead of reading it again (a diff's header: who, when, why; a shelve's actions).
 */
export interface PageSeed {
  readAt: number;
  changeset?: Changeset;
  shelve?: Shelve;
}

/**
 * A page of a place (a workspace, or a repository explored without one) opened in a window of its own
 * (`windows.openPage`), beside the place's window, which it belongs to: it closes with it, or once it leaves the place.
 */
export interface PageWindowOpening {
  place: Place;
  page: PageWindowPage;
  /**
   * The diff the page shows, already read where it opened: the page window's first read of it takes these instead of
   * asking `cm diff` again (`HandedOverDiffs`).
   */
  diff?: { target: DiffTarget; entries: DiffEntry[] };
  seed?: PageSeed;
}
