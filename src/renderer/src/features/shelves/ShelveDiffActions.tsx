import { ArchiveRestore, MoreHorizontal } from 'lucide-react';
import { useWorkspaceUser } from '../../app/account/accounts';
import { navigation } from '../../app/navigation/navigationStore';
import { useSettings } from '../../app/settings/useSettings';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { withoutAction } from '../../lib/actions';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { cachedShelve } from './cachedShelve';
import { myShelves } from './myShelves';
import { shelveMenu } from './shelveMenu';
import { applyShelve } from './shelveOperations';

/**
 * A shelve's diff previews what applying it brings: Apply (Restore for changes a switch left) is right there, and
 * leads to Changes once done. Only for a shelve a list already read, so opening the diff reads nothing more.
 * Someone else's is only applied: never deleted from here.
 */
export function ShelveDiffActions({ shelveId }: { shelveId: number }) {
  const workspacePath = useWorkspacePath();
  const { switchShelves } = useSettings();
  const me = useWorkspaceUser();
  const shelve = cachedShelve(workspacePath, shelveId);
  if (!shelve) return null;

  const { left, mine } = myShelves([shelve], switchShelves, { everyone: true, me })[0]!;
  const apply = async (deleteShelve: boolean): Promise<void> => {
    if (await applyShelve(workspacePath, shelveId, deleteShelve)) navigation.goToView('changes');
  };
  // The page is the shelve's diff and its button applies it: the rest of its menu is behind "More actions".
  const menu = withoutAction(
    withoutAction(shelveMenu(workspacePath, [shelve], { left, mine, onApplied: () => navigation.goToView('changes'), onDeleted: () => navigation.goBack() }), 'diff'),
    'apply',
  );

  return (
    <>
      <Button
        variant="primary"
        icon={<ArchiveRestore size={14} />}
        data-tip={left ? 'Apply the changes and delete the shelve' : 'Merge the shelved changes into the workspace; the shelve stays'}
        onClick={() => void apply(left)}
      >
        {left ? 'Restore' : 'Apply'}
      </Button>
      <ActionDropdownMenu entries={menu}>
        <IconButton icon={<MoreHorizontal size={14} />} label="More actions" />
      </ActionDropdownMenu>
    </>
  );
}
