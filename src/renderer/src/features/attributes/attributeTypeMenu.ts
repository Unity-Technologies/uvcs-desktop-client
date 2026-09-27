import { MessageSquareText, Pencil, Trash2 } from 'lucide-react';
import type { AttributeType } from '@shared/domain/attribute';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { deleteAttributeTypes, editAttributeComment, renameAttributeType } from './attributeOperations';
import { hotkey } from '../../lib/shortcutRegistry';

export function attributeTypeMenu(workspacePath: string, types: AttributeType[]): MenuEntry[] {
  const single = types.length === 1 ? types[0]! : null;
  return groupedMenu({
    edit: [
      single && { id: 'comment', label: 'Edit comment…', icon: MessageSquareText, run: () => void editAttributeComment(workspacePath, single) },
      single && { id: 'rename', label: 'Rename…', icon: Pencil, shortcut: hotkey('rename'), run: () => void renameAttributeType(workspacePath, single) },
    ],
    danger: [types.length > 0 && { id: 'delete', label: 'Delete…', icon: Trash2, danger: true, run: () => void deleteAttributeTypes(workspacePath, types) }],
  });
}
