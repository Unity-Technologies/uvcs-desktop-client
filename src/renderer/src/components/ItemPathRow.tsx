import type { ReactNode } from 'react';
import type { ItemType } from '@shared/domain/pendingChanges';
import { fileNameOf } from '../lib/text';
import { ItemIcon } from './ItemIcon';
import { ItemRow, type ItemPresence } from './ItemRow';
import { ItemStatusMark, type ItemStatusMarkProps } from './ItemStatusMark';
import { PathLabel } from './PathLabel';

interface ItemPathRowProps {
  /** Its path, shown with the folders dimmed (`PathLabel`), or its name alone with `nameOnly` (in a tree). */
  path: string;
  itemType: ItemType;
  /** Where a moved item was, for its tooltip. */
  oldPath?: string;
  nameOnly?: boolean;
  /** Fuzzy-matched positions in `path` to highlight. */
  matches?: readonly number[];
  /** Its status letter at the end of the row; a deleted item's name is struck through. */
  status?: ItemStatusMarkProps['status'];
  changesInside?: boolean;
  /** Just left of the status, in this order: tags ("modified", a merge), conflict states, locks, review marks. */
  extras?: ReactNode;
  presence?: ItemPresence;
  faded?: boolean;
  /** False where the element around it names the path already. */
  tooltip?: boolean;
}

/** An item named by its path, as every list of changed files shows one: `ItemRow` with its icon, path and status. */
export function ItemPathRow({ path, itemType, oldPath, nameOnly, matches, status, changesInside, extras, presence, faded, tooltip }: ItemPathRowProps) {
  return (
    <ItemRow
      icon={<ItemIcon itemType={itemType} name={fileNameOf(path)} />}
      label={<PathLabel path={path} nameOnly={nameOnly} oldPath={oldPath} matches={matches} tooltip={tooltip} fitContent />}
      extras={extras}
      status={<ItemStatusMark status={status} changesInside={changesInside} />}
      presence={presence}
      deleted={status?.tone === 'deleted'}
      faded={faded}
    />
  );
}
