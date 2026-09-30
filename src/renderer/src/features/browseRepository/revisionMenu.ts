import type { TreeItem } from '@shared/domain/explorer';
import { otherRepository } from '@shared/domain/repository';
import { revisionRef } from '@shared/domain/revision';
import { spec } from '@shared/domain/specs';
import { navigation } from '../../app/navigation/navigationStore';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { copySubmenu } from '../../components/copyMenu';
import { menuAction } from '../../components/menuWords';
import { openRevision, saveRevisionAs } from '../history/revisionOperations';

/**
 * The context menu of items in the repository tree of a changeset (not in the workspace). `repository` is the one
 * browsed: an item under an xlink is in another, which no path at `changesetId` reaches, so its spec names its revision.
 */
export function revisionMenu(workspacePath: string, changesetId: number, repository: string | undefined, items: TreeItem[]): MenuEntry[] {
  const single = items.length === 1 ? items[0]! : null;
  const file = single && single.itemType !== 'directory' ? single : null;
  const singleSpec =
    single && (otherRepository(single.repository, repository) ? spec.revision(single) : spec.serverPathAtChangeset(`/${single.path}`, changesetId));

  return groupedMenu([
    single && menuAction('history', () => navigation.openPage({ kind: 'history', path: single.path, revision: revisionRef(single) })),
    file && menuAction('openRevision', () => void openRevision(workspacePath, revisionRef(file), file.name)),
    file && menuAction('saveAs', () => void saveRevisionAs(workspacePath, revisionRef(file), file.name)),
    copySubmenu('', { serverPath: items.map((item) => `/${item.path}`).join('\n'), spec: singleSpec }, { count: items.length }),
  ]);
}
