import { ArchiveRestore, MoreHorizontal } from 'lucide-react';
import { usePlaceUser } from '../../app/account/accounts';
import { navigation } from '../../app/navigation/navigationStore';
import { useSettings } from '../../app/settings/useSettings';
import { usePlace } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { useCachedShelve } from './cachedShelve';
import { shelveDiffMenu } from './shelveDiffMenu';
import { applyShelve } from './shelveOperations';

/**
 * A shelve's diff previews what applying it brings: Apply (Restore for changes a switch left) is right there, and
 * leads to Changes once done. Only for a shelve a list already read, so opening the diff reads nothing more.
 * Someone else's is only applied: never deleted from here.
 */
export function ShelveDiffActions({ shelveId }: { shelveId: number }) {
  const place = usePlace();
  const { switchShelves } = useSettings();
  const me = usePlaceUser();
  const shelve = useCachedShelve(place, shelveId);
  if (!shelve) return null;

  const { appliesTo, left, menu } = shelveDiffMenu(place, shelve, {
    records: switchShelves,
    me,
    onApplied: () => navigation.goToView('changes'),
    onDeleted: () => navigation.goBack(),
  });
  const apply = async (workspacePath: string, deleteShelve: boolean): Promise<void> => {
    if (await applyShelve(workspacePath, shelveId, deleteShelve)) navigation.goToView('changes');
  };

  return (
    <>
      {appliesTo !== null && (
        <Button
          variant="primary"
          icon={<ArchiveRestore size={14} />}
          data-tip={left ? 'Apply the changes and delete the shelve' : 'Merge the shelved changes into the workspace; the shelve stays'}
          onClick={() => void apply(appliesTo, left)}
        >
          {left ? 'Restore' : 'Apply'}
        </Button>
      )}
      <ActionDropdownMenu entries={menu}>
        <IconButton icon={<MoreHorizontal size={14} />} label="More actions" />
      </ActionDropdownMenu>
    </>
  );
}
