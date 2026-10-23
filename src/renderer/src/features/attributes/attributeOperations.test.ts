import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));

import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import type { AttributeType } from '@shared/domain/attribute';
import { answerConfirms, answerPrompts } from '../../testing/fakeDialogs';
import { watchRefreshes, watchRepositoryRefreshes } from '../../testing/operationOutcome';
import { deleteAttributeTypes, editAttributeComment, renameAttributeType, saveAttributeComment } from './attributeOperations';

const ws = '/ws';
const inWs = workspacePlace(ws);
const ATTRIBUTE_AREAS = ['attributeTypes', 'attributeUsedValues', 'attributeValues'];
const type = (name: string): AttributeType => ({ id: 1, name, comment: 'default: open', owner: 'ana', date: '', repository: 'game@local' });

describe('attribute operations', () => {
  it('renames to the name typed, refreshing only what shows attributes', async () => {
    answerPrompts('state');
    fakeApi.answer('attributes.renameType', () => undefined);
    const refreshed = watchRefreshes(ws);

    await renameAttributeType(inWs, type('status'));

    expect(fakeApi.argsOf('attributes.renameType')).toEqual([[inWs, 'status', 'state']]);
    expect(refreshed()).toEqual(ATTRIBUTE_AREAS);
  });

  it('saves an emptied comment, but nothing when the prompt is cancelled', async () => {
    fakeApi.answer('attributes.editTypeComment', () => undefined);

    await editAttributeComment(inWs, type('status'));
    answerPrompts('');
    await editAttributeComment(inWs, type('status'));

    expect(fakeApi.argsOf('attributes.editTypeComment')).toEqual([[inWs, 'status', '']]);
  });

  it('tells whether a comment was saved, so an unsaved one stays in its editor', async () => {
    fakeApi.answer('attributes.editTypeComment', () => {
      throw new Error('offline');
    });
    expect(await saveAttributeComment(inWs, type('status'), 'x')).toBe(false);
  });

  it('deletes the attributes picked in one call once confirmed, refreshing only what shows attributes', async () => {
    fakeApi.answer('attributes.deleteType', () => undefined);
    const refreshed = watchRefreshes(ws);

    answerConfirms(false);
    await deleteAttributeTypes(inWs, [type('status')]);
    expect(fakeApi.methods()).toEqual([]);

    await deleteAttributeTypes(inWs, [type('status'), type('owner')]);
    expect(fakeApi.argsOf('attributes.deleteType')).toEqual([[inWs, ['status', 'owner']]]);
    expect(refreshed()).toEqual(ATTRIBUTE_AREAS);
  });
});

describe('attributes of a repository explored without a workspace', () => {
  it('renames there, refreshing only what shows its attributes', async () => {
    answerPrompts('state');
    fakeApi.answer('attributes.renameType', () => undefined);
    const repository = repositoryPlace('game@local');
    const refreshed = watchRepositoryRefreshes('game@local');

    await renameAttributeType(repository, type('status'));

    expect(fakeApi.argsOf('attributes.renameType')).toEqual([[repository, 'status', 'state']]);
    expect(refreshed()).toEqual(['attributeTypes', 'attributeUsedValues', 'attributeValues']);
  });
});
