import { useMemo } from 'react';
import type { TreeItem } from '@shared/domain/explorer';
import type { WorkspaceInfo } from '@shared/domain/workspace';

import { repositoryLinkTo } from '../../app/links/linkTo';
import { useNavigation } from '../../app/navigation/navigationStore';
import { useOfferSelectedObjectLink } from '../../app/links/selectedObjectLink';
import { useSelectedLines } from '../diff/selectedLinesStore';
import type { LineLinks } from '../diff/viewer/lineLinks';
import { filesItemLink, filesLinesPublished, filesShownLink } from './filesItemLink';
import type { PendingChangesIndex } from './itemStatus';

/** Where Files' items come from, as their links name it (`filesItemLink`). */
type FilesOrigin = Pick<WorkspaceInfo, 'repository' | 'selector' | 'loadedChangeset'>;

/**
 * The Files view's links (docs/features/deep-links.md, "Where links are copied"): ⇧⌘C copies the focused item's, its
 * selected lines' when there are some (`filesShownLink`), read as it runs; its viewer's lines get the chip and menu
 * (`LineLinks.linkOf`), as `filesLinesPublished` says. `workspace` is where the files come from: a workspace's info,
 * or a branch's latest in a repository explored without one (`branchFilesOrigin`), which has no pending changes.
 */
export function useFilesItemLinks(workspace: FilesOrigin | undefined, focused: TreeItem | undefined, pendingIndex?: PendingChangesIndex): LineLinks {
  const linkable = Boolean(workspace && focused && filesItemLink(workspace, focused));
  const changed = focused !== undefined && pendingIndex?.changeAt(focused.path) !== undefined;
  const covered = useNavigation((state) => state.pages.length > 0);
  const publishes = filesLinesPublished({ linkable, changed, covered });
  useOfferSelectedObjectLink(
    linkable &&
      (async () => {
        const target = filesShownLink(workspace!, focused!, useSelectedLines.getState().selected, { changed });
        return target ? repositoryLinkTo(workspace!.repository, target) : undefined;
      }),
  );
  return useMemo(
    () => ({ focus: null, publishes, linkOf: (lines) => (workspace && focused ? filesItemLink(workspace, focused, lines, { changed }) : null) }),
    [publishes, workspace, focused, changed],
  );
}
