import { describe, expect, it } from 'vitest';
import { repositoryGuidFor } from '../testing/stableIdsFor';
import {
  MAX_RECENT_COMMENT_REPOSITORIES,
  MAX_RECENT_COMMENTS,
  recentCommentsFor,
  recentCommentsOffer,
  withRecentComment,
  withRecentCommentsKeptByGuid,
  type RecentCommentSettings,
} from './recentComments';
import type { RepositoryGuid } from './stableIds';

const GAME = repositoryGuidFor(1);
const ART = repositoryGuidFor(2);

function settingsWith(overrides: Partial<RecentCommentSettings> = {}): RecentCommentSettings {
  return { recentComments: [], recentCommentsByRepository: {}, ...overrides };
}

/** Applies what `withRecentComment` changes, as the settings store does. */
function remember(settings: RecentCommentSettings, repository: RepositoryGuid, comment: string): RecentCommentSettings {
  return { ...settings, ...withRecentComment(settings, repository, comment) };
}

describe('recentCommentsFor', () => {
  it("offers a repository its own comments, never another repository's", () => {
    const settings = settingsWith({ recentCommentsByRepository: { [GAME]: ['Fix cs:4207'], [ART]: ['New textures'] } });

    expect(recentCommentsFor(settings, GAME)).toEqual(['Fix cs:4207']);
    expect(recentCommentsFor(settings, ART)).toEqual(['New textures']);
  });

  it('offers the comments kept before they were per repository to a repository with none of its own yet', () => {
    const settings = settingsWith({ recentComments: ['Older comment'], recentCommentsByRepository: { [ART]: ['New textures'] } });

    expect(recentCommentsFor(settings, GAME)).toEqual(['Older comment']);
    expect(recentCommentsFor(settings, ART)).toEqual(['New textures']);
  });

  it("offers nothing while the workspace's repository isn't known", () => {
    expect(recentCommentsFor(settingsWith({ recentComments: ['Older comment'] }), undefined)).toEqual([]);
  });

  it('offers nothing of what was kept by the repository’s spec until it is kept by its GUID', () => {
    const settings = settingsWith({ recentComments: ['Older comment'], recentCommentsByRepository: { 'game@acme@unity': ['Fix cs:4207'] } });

    expect(recentCommentsFor(settings, GAME)).toEqual(['Older comment']);
  });
});

describe('withRecentComment', () => {
  it("starts a repository's own list with its first check-in, leaving the older comments to the repositories without one", () => {
    const settings = remember(settingsWith({ recentComments: ['Older comment'] }), GAME, 'Fix cs:4207');

    expect(recentCommentsFor(settings, GAME)).toEqual(['Fix cs:4207']);
    expect(recentCommentsFor(settings, ART)).toEqual(['Older comment']);
  });

  it('never changes the comments kept before they were per repository', () => {
    expect(withRecentComment(settingsWith({ recentComments: ['Older comment'] }), GAME, 'Fix')).not.toHaveProperty('recentComments');
  });

  it(`keeps a repository's ${MAX_RECENT_COMMENTS} latest comments, the newest first and each once`, () => {
    const older = Array.from({ length: MAX_RECENT_COMMENTS }, (_, index) => `comment ${index}`);
    let settings = settingsWith({ recentCommentsByRepository: { [GAME]: older } });

    settings = remember(settings, GAME, 'comment 3');
    expect(recentCommentsFor(settings, GAME)).toEqual(['comment 3', ...older.filter((comment) => comment !== 'comment 3')]);

    settings = remember(settings, GAME, 'new');
    expect(recentCommentsFor(settings, GAME)).toHaveLength(MAX_RECENT_COMMENTS);
    expect(recentCommentsFor(settings, GAME)[0]).toBe('new');
  });

  it(`keeps the comments of the ${MAX_RECENT_COMMENT_REPOSITORIES} repositories checked in to last, forgetting the one left longest`, () => {
    const repositories = Array.from({ length: MAX_RECENT_COMMENT_REPOSITORIES }, (_, index) => repositoryGuidFor(index));
    let settings = settingsWith();
    for (const [index, repository] of repositories.entries()) settings = remember(settings, repository, `In repo${index}`);
    settings = remember(settings, repositories[0]!, 'Again in repo0');

    const newOne = repositoryGuidFor(MAX_RECENT_COMMENT_REPOSITORIES);
    settings = remember(settings, newOne, 'In new');

    expect(Object.keys(settings.recentCommentsByRepository)).toHaveLength(MAX_RECENT_COMMENT_REPOSITORIES);
    expect(recentCommentsFor(settings, repositories[0])).toEqual(['Again in repo0', 'In repo0']);
    expect(recentCommentsFor(settings, repositories[1])).toEqual([]);
    expect(recentCommentsFor(settings, newOne)).toEqual(['In new']);
  });
});

describe('withRecentCommentsKeptByGuid', () => {
  it('moves what the spec kept under the GUID, however the spec is written, in its place among the repositories checked in to last', () => {
    const byRepository = { [ART]: ['New textures'], 'game@acme@unity': ['Fix cs:4207'], 'tools@acme@unity': ['Build'] };

    const moved = withRecentCommentsKeptByGuid(byRepository, 'Game@ACME@unity', GAME);

    expect(Object.entries(moved)).toEqual([
      [ART, ['New textures']],
      [GAME, ['Fix cs:4207']],
      ['tools@acme@unity', ['Build']],
    ]);
  });

  it('drops what the spec kept when the GUID keeps its own, newer', () => {
    expect(withRecentCommentsKeptByGuid({ [GAME]: ['Newer'], 'game@acme@unity': ['Older'] }, 'game@acme@unity', GAME)).toEqual({ [GAME]: ['Newer'] });
  });

  it('changes nothing when the spec kept nothing', () => {
    const byRepository = { [GAME]: ['Fix'] };

    expect(withRecentCommentsKeptByGuid(byRepository, 'game@acme@unity', GAME)).toBe(byRepository);
  });
});

describe('recentCommentsOffer', () => {
  it('offers the repository’s comments once its GUID is known, and nothing to open while it has none', () => {
    const settings = settingsWith({ recentCommentsByRepository: { [GAME]: ['Fix cs:4207'] } });

    expect(recentCommentsOffer(settings, GAME)).toEqual({ offered: true, comments: ['Fix cs:4207'], waiting: null });
    expect(recentCommentsOffer(settings, ART)).toEqual({ offered: false, comments: [], waiting: null });
  });

  it('offers the menu before the GUID is read while any comment is kept, the GUID read as it opens', () => {
    expect(recentCommentsOffer(settingsWith({ recentCommentsByRepository: { [ART]: ['New textures'] } }), undefined).offered).toBe(true);
    expect(recentCommentsOffer(settingsWith({ recentComments: ['Older comment'] }), undefined).offered).toBe(true);
    expect(recentCommentsOffer(settingsWith(), undefined).offered).toBe(false);
  });

  it('says the comments are loading while the GUID is read, never opening an empty menu', () => {
    expect(recentCommentsOffer(settingsWith({ recentComments: ['Older comment'] }), undefined)).toEqual({ offered: true, comments: [], waiting: 'Loading…' });
  });

  it('says the comments couldn’t be read when the GUID can’t be', () => {
    expect(recentCommentsOffer(settingsWith({ recentComments: ['Older comment'] }), undefined, { unreadable: true })).toEqual({
      offered: true,
      comments: [],
      waiting: "Couldn't load this repository's recent comments",
    });
  });
});
