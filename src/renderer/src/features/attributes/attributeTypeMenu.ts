import type { Place } from '@shared/domain/place';
import type { AttributeType } from '@shared/domain/attribute';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { menuAction } from '../../components/menuWords';
import { openObjectPermissions } from '../permissions/openPermissions';
import { deleteAttributeTypes, editAttributeComment, renameAttributeType } from './attributeOperations';
import { hotkey } from '../../lib/shortcutRegistry';

export function attributeTypeMenu(place: Place, types: AttributeType[]): MenuEntry[] {
  const single = types.length === 1 ? types[0]! : null;
  return groupedMenu([
    single && menuAction('editComment', () => void editAttributeComment(place, single)),
    single && menuAction('rename', () => void renameAttributeType(place, single), { shortcut: hotkey('rename') }),
    single && menuAction('permissions', () => openObjectPermissions(place, 'attribute', single)),
    types.length > 0 && menuAction('delete', () => void deleteAttributeTypes(place, types)),
  ]);
}
