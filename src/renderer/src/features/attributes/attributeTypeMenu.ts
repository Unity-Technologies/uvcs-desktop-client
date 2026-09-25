import { MessageSquareText, Pencil, Trash2 } from 'lucide-react';
import type { AttributeType } from '@shared/domain/attribute';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { deleteAttributeTypes, editAttributeComment, renameAttributeType } from './attributeOperations';

export function attributeTypeMenu(workspacePath: string, types: AttributeType[]): MenuEntry[] {
  const single = types.length === 1 ? types[0]! : null;
  return tidyMenu([
    single && { id: 'comment', label: 'Edit comment…', icon: MessageSquareText, run: () => void editAttributeComment(workspacePath, single) },
    single && { id: 'rename', label: 'Rename…', icon: Pencil, run: () => void renameAttributeType(workspacePath, single) },
    SEPARATOR,
    types.length > 0 && { id: 'delete', label: 'Delete…', icon: Trash2, danger: true, run: () => void deleteAttributeTypes(workspacePath, types) },
  ]);
}
