import '../../testing/fakeWindow';
import { join } from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { WorkspaceHead } from '@shared/domain/workspace';
import { workspaceHeadsQuery, workspaceListQuery } from '../workspace/workspaceQueries';
import { workspacePreviewFromCache } from './workspacePreview';

const PATH = join('work', 'space-racer');
const HEAD: WorkspaceHead = { repository: 'space-racer@local', repositoryName: 'space-racer', selector: { kind: 'branch', name: '/main' } };

describe('workspacePreviewFromCache', () => {
  it('reads what the home screen’s workspace list and heads queries left in the cache', () => {
    const client = new QueryClient();
    client.setQueryData(workspaceListQuery.queryKey, [{ name: 'space-racer', path: PATH, guid: 'a' }]);
    client.setQueryData(workspaceHeadsQuery([join('work', 'other'), PATH]).queryKey, { [PATH]: HEAD });

    expect(workspacePreviewFromCache(client, PATH)).toEqual({ name: 'space-racer', repository: 'space-racer@local', selector: { kind: 'branch', name: '/main' } });
  });

  it('knows nothing from an empty cache', () => {
    expect(workspacePreviewFromCache(new QueryClient(), PATH)).toEqual({ name: undefined, repository: undefined, selector: undefined });
  });
});
