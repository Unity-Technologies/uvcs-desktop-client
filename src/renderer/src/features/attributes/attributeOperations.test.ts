import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const asked = vi.hoisted(() => ({ confirmed: true, typed: undefined as string | undefined }));
vi.mock('../../ui/dialog/confirm', () => ({ confirm: async () => asked.confirmed }));
vi.mock('../../ui/dialog/prompt', () => ({ prompt: async () => asked.typed }));

import type { AttributeType } from '@shared/domain/attribute';
import { watchRefreshes } from '../../testing/operationOutcome';
import { deleteAttributeTypes, editAttributeComment, renameAttributeType, saveAttributeComment } from './attributeOperations';

const ws = '/ws';
const ATTRIBUTE_AREAS = ['attributeTypes', 'attributeUsedValues', 'attributeValues'];
const type = (name: string): AttributeType => ({ id: 1, name, comment: 'default: open', owner: 'ana', date: '', repository: 'game@local' });

beforeEach(() => {
  asked.confirmed = true;
  asked.typed = undefined;
});

describe('attribute operations', () => {
  it('renames to the name typed, refreshing only what shows attributes', async () => {
    asked.typed = 'state';
    fakeApi.answer('attributes.renameType', () => undefined);
    const refreshed = watchRefreshes(ws);

    await renameAttributeType(ws, type('status'));

    expect(fakeApi.argsOf('attributes.renameType')).toEqual([[ws, 'status', 'state']]);
    expect(refreshed()).toEqual(ATTRIBUTE_AREAS);
  });

  it('saves an emptied comment, but nothing when the prompt is cancelled', async () => {
    fakeApi.answer('attributes.editTypeComment', () => undefined);

    await editAttributeComment(ws, type('status'));
    asked.typed = '';
    await editAttributeComment(ws, type('status'));

    expect(fakeApi.argsOf('attributes.editTypeComment')).toEqual([[ws, 'status', '']]);
  });

  it('tells whether a comment was saved, so an unsaved one stays in its editor', async () => {
    fakeApi.answer('attributes.editTypeComment', () => {
      throw new Error('offline');
    });
    expect(await saveAttributeComment(ws, type('status'), 'x')).toBe(false);
  });

  it('deletes the attributes picked in one call once confirmed, refreshing only what shows attributes', async () => {
    fakeApi.answer('attributes.deleteType', () => undefined);
    const refreshed = watchRefreshes(ws);

    asked.confirmed = false;
    await deleteAttributeTypes(ws, [type('status')]);
    expect(fakeApi.methods()).toEqual([]);

    asked.confirmed = true;
    await deleteAttributeTypes(ws, [type('status'), type('owner')]);
    expect(fakeApi.argsOf('attributes.deleteType')).toEqual([[ws, ['status', 'owner']]]);
    expect(refreshed()).toEqual(ATTRIBUTE_AREAS);
  });
});
