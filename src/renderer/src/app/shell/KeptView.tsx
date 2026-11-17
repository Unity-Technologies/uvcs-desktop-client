import { memo } from 'react';
import type { Page } from '../navigation/pages';
import { viewDefinition } from '../navigation/viewRegistry';
import type { ViewId } from '../navigation/views';
import { ViewShownContext } from '../../lib/viewShown';
import { PageFrame } from './PageFrame';
import { viewLayerShown } from './viewLayer';
import styles from './PlaceLayout.module.css';

interface KeptViewProps {
  view: ViewId;
  /** The view's pages, in the order they stacked: the one on top shows, over the view. */
  pages: readonly Page[];
  /** Whether it draws its page on top: not the merge in progress, which has a layer of its own (`PlaceLayout`). */
  drawsTop: boolean;
}

/**
 * A view of the place with the page on top of it, mounted whether shown or not (`mountedViews`): hidden, in an
 * `Activity`, it keeps all it shows as the user left it while its effects stop. Memoized, so the hidden ones don't
 * render again as the view shown moves.
 */
export const KeptView = memo(function KeptView({ view, pages, drawsTop }: KeptViewProps) {
  const View = viewDefinition(view).component;
  const top = pages.at(-1);
  const listShown = viewLayerShown(top);

  return (
    <>
      {/* The view stays mounted under its pages so going back keeps its scroll and selection. */}
      <div className={styles.layer} hidden={!listShown}>
        <ViewShownContext.Provider value={listShown}>
          <View />
        </ViewShownContext.Provider>
      </div>
      {top && drawsTop && <PageFrame key={pages.length} page={top} view={view} previous={pages.at(-2)} />}
    </>
  );
});
