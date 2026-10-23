import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

describe('The lists of objects read for a workspace', () => {
  it("keep an xlinked repository's apart from the workspace's, which every view of them shares", () => {
    expect(queryKeys.objectList('/ws', 'branches', {})).toEqual(['workspace', '/ws', 'branches', {}]);
    expect(queryKeys.objectList('/ws', 'labels', {}, 'lib@local')).not.toEqual(queryKeys.objectList('/ws', 'labels', {}));
    expect(queryKeys.objectList('/ws', 'labels', {}, 'lib@local')).not.toEqual(queryKeys.objectList('/ws', 'labels', {}, 'art@local'));
  });

  it("keep another repository's out of the workspace's areas, which caches scan for the workspace's own objects", () => {
    expect(queryKeys.objectList('/ws', 'changesets', { limit: 2000 }, 'lib@local').slice(0, 3)).toEqual(['workspace', '/ws', 'otherRepository']);
  });
});
