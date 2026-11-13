import { describe, expect, it } from 'vitest';
import { MAX_RECENT_COMMENT_REPOSITORIES, MAX_RECENT_COMMENTS, recentCommentsFor, withRecentComment, type RecentCommentSettings } from './recentComments';

const GAME = 'game@acme@unity';
const ART = 'art@acme@unity';

function settingsWith(overrides: Partial<RecentCommentSettings> = {}): RecentCommentSettings {
  return { recentComments: [], recentCommentsByRepository: {}, ...overrides };
}

/** Applies what `withRecentComment` changes, as the settings store does. */
function remember(settings: RecentCommentSettings, repository: string, comment: string): RecentCommentSettings {
  return { ...settings, ...withRecentComment(settings, repository, comment) };
}

describe('recentCommentsFor', () => {
  it("offers a repository its own comments, never another repository's", () => {
    const settings = settingsWith({ recentCommentsByRepository: { [GAME]: ['Fix cs:4207'], [ART]: ['New textures'] } });

    expect(recentCommentsFor(settings, GAME)).toEqual(['Fix cs:4207']);
    expect(recentCommentsFor(settings, ART)).toEqual(['New textures']);
  });

  it('offers the comments to every workspace of the repository, however it writes its name and server', () => {
    const settings = remember(settingsWith(), 'Game@ACME@unity', 'Fix cs:4207');

    expect(recentCommentsFor(settings, 'game@acme@unity')).toEqual(['Fix cs:4207']);
  });

  it('offers the comments kept before they were per repository to a repository with none of its own yet', () => {
    const settings = settingsWith({ recentComments: ['Older comment'], recentCommentsByRepository: { [ART]: ['New textures'] } });

    expect(recentCommentsFor(settings, GAME)).toEqual(['Older comment']);
    expect(recentCommentsFor(settings, ART)).toEqual(['New textures']);
  });

  it("offers nothing while the workspace's repository isn't known", () => {
    expect(recentCommentsFor(settingsWith({ recentComments: ['Older comment'] }), undefined)).toEqual([]);
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
    const repositories = Array.from({ length: MAX_RECENT_COMMENT_REPOSITORIES }, (_, index) => `repo${index}@local`);
    let settings = settingsWith();
    for (const repository of repositories) settings = remember(settings, repository, `In ${repository}`);
    settings = remember(settings, 'repo0@local', 'Again in repo0');

    settings = remember(settings, 'new@local', 'In new');

    expect(Object.keys(settings.recentCommentsByRepository)).toHaveLength(MAX_RECENT_COMMENT_REPOSITORIES);
    expect(recentCommentsFor(settings, 'repo0@local')).toEqual(['Again in repo0', 'In repo0@local']);
    expect(recentCommentsFor(settings, 'repo1@local')).toEqual([]);
    expect(recentCommentsFor(settings, 'new@local')).toEqual(['In new']);
  });
});
