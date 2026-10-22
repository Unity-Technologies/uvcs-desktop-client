import { useMemo } from 'react';
import type { TreeItem } from '@shared/domain/explorer';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { repositoryLinkTo } from '../../app/links/linkTo';
import { useOfferSelectedObjectLink } from '../../app/links/selectedObjectLink';
import { useSelectedLines } from '../diff/selectedLinesStore';
import type { LineLinks } from '../diff/viewer/lineLinks';
import { filesItemLink, filesShownLink } from './filesItemLink';

/**
 * The Files view's links (docs/features/deep-links.md, "Where links are copied"): ⇧⌘C copies the focused item's, its
 * selected lines' when there are some (`filesShownLink`), read as it runs; its viewer's lines get the chip and menu
 * (`LineLinks.linkOf`), but for an item with pending changes (`changed`), whose lines are the workspace's own.
 */
export function useFilesItemLinks(workspace: WorkspaceInfo | undefined, focused: TreeItem | undefined, changed: boolean): LineLinks {
  const linkable = Boolean(workspace && focused && filesItemLink(workspace, focused));
  useOfferSelectedObjectLink(
    linkable &&
      (async () => {
        const target = filesShownLink(workspace!, focused!, useSelectedLines.getState().selected, { changed });
        return target ? repositoryLinkTo(workspace!.repository, target) : undefined;
      }),
  );
  return useMemo(
    () => ({ focus: null, publishes: linkable && !changed, linkOf: (lines) => (workspace && focused ? filesItemLink(workspace, focused, lines, { changed }) : null) }),
    [linkable, workspace, focused, changed],
  );
}
