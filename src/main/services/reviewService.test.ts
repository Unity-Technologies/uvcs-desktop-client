import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { formatOutput, WORKSPACE_GUID, WORKSPACE_NAMES } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { memorySettings } from '../settings/testing/memorySettings';
import { createReviewService } from './reviewService';
import { serviceContext } from './testing/serviceContext';

const GAME = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

/** `cm repository list` of acme@cloud as it prints it: id, name, server, owner, type, GUID. */
const LISTED = formatOutput(['1', 'game', 'acme@cloud', 'ana', 'VCS', GAME]);

function review(answers: Record<string, CmAnswer>, reviewModeWorkspaces: string[] = []) {
  const fake = fakeCmClient(answers);
  const settings = memorySettings({ reviewModeWorkspaces });
  return { ...fake, settings, service: createReviewService(serviceContext(fake.cm, { settings })) };
}

describe('reviewModeKey', () => {
  it("keeps a workspace's review mode by its GUID, read locally: a rename or a move keeps it", async () => {
    const { service, lines } = review({ getworkspacefrompath: WORKSPACE_NAMES });

    expect(await service.reviewModeKey(workspacePlace('/work'))).toBe(WORKSPACE_GUID);
    expect(await service.reviewModeKey(workspacePlace('/moved/work'))).toBe(WORKSPACE_GUID);
    expect(lines().every((line) => line.startsWith('getworkspacefrompath'))).toBe(true);
  });

  it("keeps a repository's by its GUID, from one listing of its server for every lookup", async () => {
    const { service, lines } = review({ 'repository list': LISTED });

    expect(await service.reviewModeKey(repositoryPlace('game@acme@cloud'))).toBe(GAME);
    expect(await service.reviewModeKey(repositoryPlace('Game@acme@cloud'))).toBe(GAME);
    expect(lines().filter((line) => line.startsWith('repository list'))).toHaveLength(1);
  });

  it('moves review mode kept by the workspace path or the repository spec to the GUID, keeping the others', async () => {
    const { service, settings } = review({ getworkspacefrompath: WORKSPACE_NAMES, 'repository list': LISTED }, ['/other', '/work', 'repository:game@acme@cloud']);

    await service.reviewModeKey(workspacePlace('/work'));
    await service.reviewModeKey(repositoryPlace('game@acme@cloud'));
    expect(settings.get().reviewModeWorkspaces).toEqual(['/other', WORKSPACE_GUID, GAME]);
  });

  it("leaves review mode off where it was off, writing nothing", async () => {
    const { service, settings } = review({ getworkspacefrompath: WORKSPACE_NAMES }, ['/other']);
    const before = settings.get();

    await service.reviewModeKey(workspacePlace('/work'));
    expect(settings.get()).toBe(before);
  });

  it('keeps it by the path or the spec when no GUID can be told: a cm that prints none, a server that cannot be listed', async () => {
    const { service } = review({ getworkspacefrompath: formatOutput(['work', '', 'regular', 'static']), 'repository list': cmFails('Unable to connect to acme@cloud') });

    expect(await service.reviewModeKey(workspacePlace('/work'))).toBe('/work');
    expect(await service.reviewModeKey(repositoryPlace('game@acme@cloud'))).toBe('repository:game@acme@cloud');
  });
});
