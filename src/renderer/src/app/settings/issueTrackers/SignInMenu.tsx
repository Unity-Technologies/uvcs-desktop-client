import { MoreHorizontal } from 'lucide-react';
import { IconButton } from '../../../ui/IconButton';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import { askToSignOut } from './askToSignOut';
import type { SignInRow } from './connectFlow';
import { signInMenuEntries } from './signInMenuEntries';

/** A sign-in's ⋯ menu beside its Use (`signInMenuEntries`): signing out of it, asked first. */
export function SignInMenu({ row }: { row: SignInRow }) {
  const menu = signInMenuEntries(row, () => void askToSignOut(row));
  return (
    <ActionDropdownMenu entries={menu.entries}>
      <IconButton size="small" icon={<MoreHorizontal size={15} />} label={menu.label} />
    </ActionDropdownMenu>
  );
}
