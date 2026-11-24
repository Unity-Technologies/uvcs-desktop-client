import type { Page } from './pages';
import { VIEW_IDS, type ViewId } from './views';

/**
 * How many views stay mounted, the one shown included: the most recently shown. Each keeps all it shows as the user
 * left it, hidden (`PlaceLayout`, React's `Activity`): its list's scroll and filter, its page on top, what was typed.
 * A view past them unmounts, and comes back from its pages alone (`KeptViews.stacks`), as a view drawn again.
 */
export const MOUNTED_VIEWS = 3;

/**
 * Where the user left each view of the place: going back to a view (the sidebar, ⌘1…, the palette) shows it as it
 * was, its pages over it (`navigation.returnToView`). Only the views not shown: the one shown has the store's `pages`.
 */
export interface KeptViews {
  /** The pages each view left showed, in the order they stacked. */
  stacks: Partial<Record<ViewId, readonly Page[]>>;
  /** The views shown, the latest first, without repeats: which stay mounted (`mountedViews`). */
  recent: readonly ViewId[];
}

/** No view left yet: what a place starts with, and what it leaves behind when another place opens. */
export const NO_KEPT_VIEWS: KeptViews = { stacks: {}, recent: [] };

/** Leaving the view shown for another one: the view `from` with the `pages` it shows, for the view `to`. */
export interface ViewSwitch {
  from: ViewId;
  pages: readonly Page[];
  to: ViewId;
  /** `asLeft`: `to` shows the pages it was left with. `list`: it shows its list, its pages closed. */
  shows: 'asLeft' | 'list';
}

/**
 * What switching views leaves: `from`'s pages kept, the pages `to` shows (taken out of the kept ones, as the shown
 * view's pages live in the store), and `to` the latest view. Switching to the view shown closes its pages.
 */
export function switchedViews(kept: KeptViews, { from, pages, to, shows }: ViewSwitch): { kept: KeptViews; pages: Page[] } {
  if (to === from) return { kept, pages: [] };
  const { [to]: left = [], ...others } = { ...kept.stacks, [from]: pages };
  const recent = [to, ...[from, ...kept.recent].filter((view) => view !== to)];
  return { kept: { stacks: others, recent: [...new Set(recent)] }, pages: shows === 'asLeft' ? [...left] : [] };
}

/**
 * The views kept mounted while `shown` shows: it and the latest others, up to `MOUNTED_VIEWS`. In the sidebar's order,
 * never the order they were shown in, so a view going back to the front never moves among the others (`PlaceLayout`).
 */
export function mountedViews(shown: ViewId, recent: readonly ViewId[]): ViewId[] {
  const latest = new Set([...new Set([shown, ...recent])].slice(0, MOUNTED_VIEWS));
  return VIEW_IDS.filter((view) => latest.has(view));
}

/** A view mounted in the place's screen (`PlaceLayout`, `KeptView`), and what it draws. */
export interface ViewLayer {
  view: ViewId;
  /** The view on screen; the others are hidden, kept as they were left. */
  shown: boolean;
  /** Its pages, in the order they stacked: the one on top shows over it. */
  pages: readonly Page[];
  /** Whether it draws its page on top: not the merge in progress shown, which has a layer of its own. */
  drawsTop: boolean;
}

/** The pages of a view left at its list: one array, so a hidden view's layer is drawn with the same ones each time. */
const NO_PAGES: readonly Page[] = [];

/**
 * The views mounted while `shown` shows with `pages` (`mountedViews`): it with its pages, the others with those they
 * were left with. `mergeShown`: the merge in progress is the page on top of the view shown (`showsMerge`).
 */
export function viewLayers(shown: ViewId, pages: readonly Page[], kept: KeptViews, mergeShown: boolean): ViewLayer[] {
  return mountedViews(shown, kept.recent).map((view) =>
    view === shown ? { view, shown: true, pages, drawsTop: !mergeShown } : { view, shown: false, pages: kept.stacks[view] ?? NO_PAGES, drawsTop: true },
  );
}
