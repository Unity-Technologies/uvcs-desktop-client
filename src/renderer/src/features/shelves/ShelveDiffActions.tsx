import { ArchiveRestore, Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { navigation } from '../../app/navigation/navigationStore';
import { useSettings } from '../../app/settings/useSettings';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { SEPARATOR, tidyMenu } from '../../lib/actions';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { cachedShelve } from './cachedShelve';
import { myShelves } from './myShelves';
import { applyShelve, deleteShelve } from './shelveOperations';

/**
 * A shelve's diff previews what applying it brings: Apply (Restore for changes a switch left) is right there, and
 * leads to Changes once done. Only for a shelve a list already read, so opening the diff reads nothing more.
 */
export function ShelveDiffActions({ shelveId }: { shelveId: number }) {
  const workspacePath = useWorkspacePath();
  const { switchShelves } = useSettings();
  const shelve = cachedShelve(workspacePath, shelveId);
  if (!shelve) return null;

  const left = myShelves([shelve], switchShelves)[0]?.left === true;
  const apply = async (deleteShelve: boolean): Promise<void> => {
    if (await applyShelve(workspacePath, shelveId, deleteShelve)) navigation.goToView('changes');
  };
  const menu = tidyMenu([
    !left && { id: 'applyAndDelete', label: 'Apply and delete', icon: ArchiveRestore, run: () => void apply(true) },
    { id: 'copy', label: 'Copy shelve spec', icon: Copy, run: () => copyToClipboard(`sh:${shelveId}`, 'Shelve spec') },
    SEPARATOR,
    {
      id: 'delete',
      label: 'Delete…',
      icon: Trash2,
      danger: true,
      run: async () => {
        if (await deleteShelve(workspacePath, shelveId)) navigation.goBack();
      },
    },
  ]);

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
