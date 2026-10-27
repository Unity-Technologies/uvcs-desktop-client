import type { Place } from '@shared/domain/place';
import type { AttributeType } from '@shared/domain/attribute';
import { api } from '../../api/client';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByAttributes } from '../../app/refresh/refreshScopes';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { validateAttributeName } from './attributeNames';

export async function renameAttributeType(place: Place, type: AttributeType): Promise<void> {
  const newName = await prompt({ title: 'Rename attribute', label: 'New name', initialValue: type.name, confirmLabel: 'Rename', validate: validateAttributeName });
  if (!newName) return;
  await runAction(place, "Couldn't rename the attribute", () => api.attributes.renameType(place, type.name, newName), isAffectedByAttributes);
}

export async function editAttributeComment(place: Place, type: AttributeType): Promise<void> {
  const comment = await prompt({ title: `Describe ${type.name}`, label: 'Comment', initialValue: type.comment, confirmLabel: 'Save' });
  if (comment !== undefined) await saveAttributeComment(place, type, comment);
}

/** Resolves to whether it saved, so a comment that couldn't be saved stays in its editor. */
export function saveAttributeComment(place: Place, type: AttributeType, comment: string): Promise<boolean> {
  return runVoidAction(place, "Couldn't update the attribute", () => api.attributes.editTypeComment(place, type.name, comment), isAffectedByAttributes);
}

export async function deleteAttributeTypes(place: Place, types: AttributeType[]): Promise<void> {
  const confirmed = await confirm({
    title: types.length === 1 ? `Delete attribute ${types[0]!.name}?` : `Delete ${types.length} attributes?`,
    message: 'Its values are removed from every branch, changeset and label. This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  await runAction(place, "Couldn't delete the attribute", () => api.attributes.deleteType(place, types.map((type) => type.name)), isAffectedByAttributes);
}
