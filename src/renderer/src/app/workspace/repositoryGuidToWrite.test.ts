import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import { repositoryGuidFor } from '@shared/testing/stableIdsFor';
import { queryClient } from '../queryClient';
import { repositoryGuidToWrite } from './repositoryGuidToWrite';

const GAME = repositoryGuidFor(1);

beforeEach(() => queryClient.clear());

describe('repositoryGuidToWrite', () => {
  it('asks the main process once per repository, however its spec is written', async () => {
    fakeApi.answer('repositories.guidOf', () => GAME);

    expect(await repositoryGuidToWrite('game@acme@unity')).toBe(GAME);
    expect(await repositoryGuidToWrite('Game@ACME@unity')).toBe(GAME);
    expect(fakeApi.argsOf('repositories.guidOf')).toEqual([['game@acme@unity']]);
  });

  it('rejects with a message to show when the server holds no such repository', async () => {
    fakeApi.answer('repositories.guidOf', () => null);

    await expect(repositoryGuidToWrite('game@acme@unity')).rejects.toThrow("Couldn't find game@acme@unity on its server.");
  });

  it('asks again after a lookup that failed, as when the server was out of reach', async () => {
    let calls = 0;
    fakeApi.answer('repositories.guidOf', () => {
      if (calls++ === 0) throw new Error('Unable to connect to acme@unity');
      return GAME;
    });

    await expect(repositoryGuidToWrite('game@acme@unity')).rejects.toThrow('Unable to connect');
    expect(await repositoryGuidToWrite('game@acme@unity')).toBe(GAME);
  });
});
