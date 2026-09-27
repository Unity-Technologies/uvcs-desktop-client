import type { AttributeType } from '@shared/domain/attribute';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { menuAction } from '../../components/menuWords';
import { deleteAttributeTypes, editAttributeComment, renameAttributeType } from './attributeOperations';
import { hotkey } from '../../lib/shortcutRegistry';

export function attributeTypeMenu(workspacePath: string, types: AttributeType[]): MenuEntry[] {
  const single = types.length === 1 ? types[0]! : null;
  return groupedMenu([
    single && menuAction('editComment', () => void editAttributeComment(workspacePath, single)),
    single && menuAction('rename', () => void renameAttributeType(workspacePath, single), { shortcut: hotkey('rename') }),
    types.length > 0 && menuAction('delete', () => void deleteAttributeTypes(workspacePath, types)),
  ]);
}
