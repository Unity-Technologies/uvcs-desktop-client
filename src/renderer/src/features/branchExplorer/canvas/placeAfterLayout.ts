import type { GraphSelection } from '../graphSelection';
import type { GraphLayout } from '../model/layoutGraph';
import type { GraphScene } from './drawContext';
import { keepPlace } from './keepPlace';
import { newestEnd } from './newestEnd';
import type { Size, Viewport } from './viewport';

type Highlights = Pick<GraphScene, 'selectedChangeset' | 'selectedBranch' | 'selectedPending' | 'homeChangeset'>;

/**
 * What a new layout holds where it was on screen, first come first: the selection (pending changes, changeset,
 * branch), then the home badge (on the pending changes the old layout drew, else on the loaded changeset).
 */
export function preferredPlaces({ selectedChangeset, selectedBranch, selectedPending, homeChangeset }: Highlights, before: GraphLayout): GraphSelection[] {
  return [
    ...(selectedPending ? [{ kind: 'pending' } as const] : []),
    ...(selectedChangeset !== null ? [{ kind: 'changeset', id: selectedChangeset } as const] : []),
    ...(selectedBranch !== null ? [{ kind: 'branch', name: selectedBranch } as const] : []),
    ...(before.pending ? [{ kind: 'pending' } as const] : []),
    ...(homeChangeset !== null ? [{ kind: 'changeset', id: homeChangeset } as const] : []),
  ];
}

/**
 * The view once the graph is laid out again (`keepPlace`): one thing on screen stays where it was; with nothing to
 * hold on to, the newest history, where work goes on.
 */
export function viewportAfterLayout(before: GraphLayout, after: GraphLayout, viewport: Viewport, screen: Size, highlights: Highlights): Viewport {
  return keepPlace(before, after, viewport, screen, preferredPlaces(highlights, before)) ?? newestEnd(after, viewport, screen);
}
