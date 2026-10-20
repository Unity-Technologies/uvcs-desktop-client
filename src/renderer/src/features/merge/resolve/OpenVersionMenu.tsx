import { ChevronDown, Layers } from 'lucide-react';
import { useExternalApps } from '../../../components/externalApps/externalApps';
import { Button } from '../../../ui/Button';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import { versionsMenu, type OpenableVersion } from './conflictVersionOpening';

/**
 * A binary conflict's way to look at its versions in other apps (two PSDs in Photoshop, two FBX in Blender): a
 * submenu per version, each listing the apps to open it in. Nothing opens until the user picks one.
 */
export function OpenVersionMenu({ versions }: { versions: OpenableVersion[] }) {
  const apps = useExternalApps();
  return (
    <ActionDropdownMenu entries={versionsMenu(versions, apps)}>
      <Button size="small" icon={<Layers size={13} />} data-tip="Open a version in another app">
        Open version
        <ChevronDown size={13} />
      </Button>
    </ActionDropdownMenu>
  );
}
