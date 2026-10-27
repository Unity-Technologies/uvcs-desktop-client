import { describe, expect, it } from 'vitest';
import { formatLink, writesAsLink } from './formatLink';
import type { Link } from './link';
import { parseLink } from './parseLink';

const game = { kind: 'repository', server: 'acme@unity', repository: 'game' } as const;

function linkIn(text: string): Link {
  const reading = parseLink(text);
  if ('problem' in reading) throw new Error(`${text}: ${JSON.stringify(reading.problem)}`);
  return reading.link;
}

describe('formatLink and parseLink', () => {
  // Every shape docs/features/deep-links.md names, as the app writes it and reads it back.
  it.each<[string, Link]>([
    ['uvcs://acme.unity/repos/game', game],
    ['uvcs://acme.unity', { kind: 'server', server: 'acme@unity' }],
    ['uvcs://acme.unity/projects/Racing', { kind: 'server', server: 'acme@unity', project: 'Racing' }],
    ['uvcs://acme.unity/projects/Cloud%20Repositories', { kind: 'server', server: 'acme@unity', project: 'Cloud Repositories' }],
    ['uvcs://host:8087', { kind: 'server', server: 'host:8087' }],
    ['uvcs://acme.unity/repos/game/-/locks', { ...game, page: { kind: 'view', view: 'locks' } }],
    ['uvcs://acme.unity/repos/game/-/files/Assets/Player.cs', { ...game, page: { kind: 'view', view: 'files', path: '/Assets/Player.cs' } }],
    ['uvcs://acme.unity/repos/game/-/browse/Assets/Player.cs#L42', { ...game, page: { kind: 'browse', path: '/Assets/Player.cs' }, lines: { side: 'new', first: 42, last: 42 } }],
    ['uvcs://acme.unity/repos/game/changesets/4207', { ...game, object: { kind: 'changeset', id: 4207 } }],
    [
      'uvcs://acme.unity/repos/game/changesets/4207/-/files/Assets/Player.cs#L40-L52',
      { ...game, object: { kind: 'changeset', id: 4207 }, page: { kind: 'diffFile', path: '/Assets/Player.cs' }, lines: { side: 'new', first: 40, last: 52 } },
    ],
    [
      'uvcs://acme.unity/repos/game/changesets/4207/-/files/Assets/Player.cs#old-L7',
      { ...game, object: { kind: 'changeset', id: 4207 }, page: { kind: 'diffFile', path: '/Assets/Player.cs' }, lines: { side: 'old', first: 7, last: 7 } },
    ],
    ['uvcs://acme.unity/repos/game/changesets/4207/-/browse', { ...game, object: { kind: 'changeset', id: 4207 }, page: { kind: 'browse', path: '/' } }],
    ['uvcs://acme.unity/repos/game/changesets/4207/-/annotate/src/a.cs#L3', { ...game, object: { kind: 'changeset', id: 4207 }, page: { kind: 'annotate', path: '/src/a.cs' }, lines: { side: 'new', first: 3, last: 3 } }],
    ['uvcs://acme.unity/repos/game/changesets/4207/-/branch-explorer', { ...game, object: { kind: 'changeset', id: 4207 }, page: { kind: 'view', view: 'branch-explorer' } }],
    ['uvcs://acme.unity/repos/game/changesets/4200..4207', { ...game, object: { kind: 'changesetRange', from: 4200, to: 4207 } }],
    ['uvcs://acme.unity/repos/game/branches/main/task001', { ...game, object: { kind: 'branch', name: '/main/task001' } }],
    [
      'uvcs://acme.unity/repos/game/branches/main/task001/-/history/src/a.cs',
      { ...game, object: { kind: 'branch', name: '/main/task001' }, page: { kind: 'history', path: '/src/a.cs' } },
    ],
    ['uvcs://acme.unity/repos/game/labels/v1.2', { ...game, object: { kind: 'label', name: 'v1.2' } }],
    ['uvcs://acme.unity/repos/game/labels/v1.1..v1.2', { ...game, object: { kind: 'labelRange', from: 'v1.1', to: 'v1.2' } }],
    ['uvcs://acme.unity/repos/game/shelves/12/-/files/a.cs#L10', { ...game, object: { kind: 'shelve', id: 12 }, page: { kind: 'diffFile', path: '/a.cs' }, lines: { side: 'new', first: 10, last: 10 } }],
    ['uvcs://acme.unity/repos/game/code-reviews/311', { ...game, object: { kind: 'codeReview', id: 311 } }],
    ['uvcs://acme.unity/repos/game/merge-requests/311', { ...game, object: { kind: 'codeReview', id: 311, asMergeRequest: true } }],
    ['uvcs://host:8087/repos/game', { kind: 'repository', server: 'host:8087', repository: 'game' }],
    ['uvcs://local/repos/game', { kind: 'repository', server: 'local', repository: 'game' }],
    ['uvcs://acme.cloud/repos/game', { kind: 'repository', server: 'acme@cloud', repository: 'game' }],
    ['uvcs:///Users/ana/wk/game', { kind: 'workspace', folder: '/Users/ana/wk/game' }],
    ['uvcs:///Users/ana/wk/game/-/incoming', { kind: 'workspace', folder: '/Users/ana/wk/game', page: { kind: 'view', view: 'incoming' } }],
    [
      'uvcs:///Users/ana/wk/game/-/changes/Assets/Player.cs#L42',
      { kind: 'workspace', folder: '/Users/ana/wk/game', page: { kind: 'view', view: 'changes', path: '/Assets/Player.cs' }, lines: { side: 'new', first: 42, last: 42 } },
    ],
    ['uvcs:///Users/ana/wk/game/-/history/a.cs', { kind: 'workspace', folder: '/Users/ana/wk/game', page: { kind: 'history', path: '/a.cs' } }],
    ['uvcs:///C:/wk/game/-/files/a.cs', { kind: 'workspace', folder: 'C:/wk/game', page: { kind: 'view', view: 'files', path: '/a.cs' } }],
  ])('%s', (text, link) => {
    expect(formatLink(link)).toBe(text);
    expect(parseLink(text)).toEqual({ link });
  });

  // Names as the real world has them: spaces, Unicode (as macOS writes it, decomposed, too), and characters a chat or a
  // markdown link would cut the link at.
  it.each<Link>([
    { ...game, repository: 'my game', object: { kind: 'branch', name: '/main/Mi rama/señal (2)' } },
    { ...game, object: { kind: 'branch', name: '/main/a+b/c#1' } },
    { ...game, object: { kind: 'label', name: "fix(2)!'*" } },
    { ...game, object: { kind: 'label', name: 'v1..2' } },
    { ...game, object: { kind: 'labelRange', from: 'a..b', to: 'c' } },
    { ...game, object: { kind: 'labelRange', from: 'v1.', to: '.v2' } },
    { ...game, repository: 'art/textures', object: { kind: 'changeset', id: 1 } },
    { ...game, object: { kind: 'changeset', id: 1 }, page: { kind: 'diffFile', path: '/Assets/Cafe\u0301 ?#%.png' } },
    { kind: 'workspace', folder: '/Users/ana/My Projects/日本', page: { kind: 'view', view: 'changes', path: '/a b.cs' } },
    { kind: 'repository', server: 'Acme Studio@unity', repository: 'game' },
  ])('reads back %j as it was written', (link) => {
    const text = formatLink(link);
    expect(text).not.toMatch(/[ ()!'*]/);
    expect(parseLink(text)).toEqual({ link });
  });

  it("writes a branch segment spelling a link's own word encoded, so it stays the branch's", () => {
    for (const name of ['/main/-', '/main/diff', '/main/path/x', '/-/diff']) {
      const link: Link = { ...game, object: { kind: 'branch', name }, page: { kind: 'diffFile', path: '/a.cs' } };
      expect(parseLink(formatLink(link))).toEqual({ link });
    }
    expect(formatLink({ ...game, object: { kind: 'branch', name: '/main/diff' } })).toBe('uvcs://acme.unity/repos/game/branches/main/%64iff');
  });

  it('writes a folder named "-" encoded, so it stays a folder', () => {
    const link: Link = { kind: 'workspace', folder: '/wk/-', page: { kind: 'view', view: 'files', path: '/-/a.cs' } };
    expect(formatLink(link)).toBe('uvcs:///wk/%2D/-/files/%2D/a.cs');
    expect(parseLink(formatLink(link))).toEqual({ link });
  });

  it('leaves the protocol of a server out: the app reaches it as it already does', () => {
    expect(formatLink({ kind: 'repository', server: 'ssl://host:8088', repository: 'game' })).toBe('uvcs://host:8088/repos/game');
  });
});

describe('parseLink', () => {
  it('takes the scheme in any case, a trailing slash, angle brackets and spaces around it', () => {
    expect(linkIn('  <UVCS://acme.unity/repos/game/changesets/12/>  ')).toEqual({ ...game, object: { kind: 'changeset', id: 12 } });
  });

  it('reads a host named like no organization, or with a port, as it is', () => {
    expect(linkIn('uvcs://build.example.com:8087/repos/game')).toMatchObject({ server: 'build.example.com:8087' });
    expect(linkIn('uvcs://plastic.local:8087/repos/game')).toMatchObject({ server: 'plastic.local:8087' });
    expect(linkIn('uvcs://acme.studio.unity/repos/game')).toMatchObject({ server: 'acme.studio@unity' });
  });

  it('reads a range of lines written without its second L, and ignores any other fragment', () => {
    expect(linkIn('uvcs://acme.unity/repos/game/changesets/1/-/files/a.cs#L4-9')).toMatchObject({ lines: { side: 'new', first: 4, last: 9 } });
    expect(linkIn('uvcs://acme.unity/repos/game/changesets/1#top')).not.toHaveProperty('lines');
  });

  it("reads a workspace's Windows folder written with backslashes", () => {
    expect(linkIn('uvcs:///C:\\Users\\ana\\wk\\game\\-\\changes\\a.cs')).toEqual({
      kind: 'workspace',
      folder: 'C:/Users/ana/wk/game',
      page: { kind: 'view', view: 'changes', path: '/a.cs' },
    });
  });

  it('reads a file of a workspace named with no page', () => {
    expect(linkIn('uvcs:///Users/ana/wk/game/Assets/Player.cs#L42')).toEqual({
      kind: 'workspace',
      folder: '/Users/ana/wk/game/Assets/Player.cs',
      lines: { side: 'new', first: 42, last: 42 },
    });
  });

  describe('older links', () => {
    // The official client's links (docs/features/deep-links.md, "Older links"), under either scheme.
    it.each<[string, Link]>([
      ['plastic://acme.cloud/repos/game/changesets/4207/diff', { ...game, server: 'acme@cloud', object: { kind: 'changeset', id: 4207 } }],
      ['uvcs://acme.cloud/repos/game/changesets/4200..4207/diff', { ...game, server: 'acme@cloud', object: { kind: 'changesetRange', from: 4200, to: 4207 } }],
      ['uvcs://acme.cloud/repos/game/branches/main/Mi+rama/MiSuperRama%24%24/diff', { ...game, server: 'acme@cloud', object: { kind: 'branch', name: '/main/Mi rama/MiSuperRama$$' } }],
      ['uvcs://acme.cloud/repos/game/branches/main/diff/diff', { ...game, server: 'acme@cloud', object: { kind: 'branch', name: '/main/diff' } }],
      ['uvcs://acme.cloud/repos/game/labels/b001..b002/diff', { ...game, server: 'acme@cloud', object: { kind: 'labelRange', from: 'b001', to: 'b002' } }],
      ['uvcs://acme.cloud/repos/game/shelvesets/12/diff', { ...game, server: 'acme@cloud', object: { kind: 'shelve', id: 12 } }],
      ['uvcs://acme.cloud/repos/game/code-reviews/311/reviewchanges', { ...game, server: 'acme@cloud', object: { kind: 'codeReview', id: 311 } }],
      ['uvcs://acme.cloud/repos/game/merge-requests/312/Conversation', { ...game, server: 'acme@cloud', object: { kind: 'codeReview', id: 312, asMergeRequest: true } }],
      ['uvcs://acme.cloud/repos/books+and+more?ui=gluon', { ...game, server: 'acme@cloud', repository: 'books and more' }],
      ['uvcs://acme.cloud/repos/game/path/ui/Effective+UI.pdf', { ...game, server: 'acme@cloud', page: { kind: 'view', view: 'files', path: '/ui/Effective UI.pdf' } }],
      [
        'uvcs://skull:9095/repos/game/branches/main/task001/path/ui/a.pdf',
        { kind: 'repository', server: 'skull:9095', repository: 'game', object: { kind: 'branch', name: '/main/task001' }, page: { kind: 'browse', path: '/ui/a.pdf' } },
      ],
      [
        'uvcs://local/repos/game/changesets/2/path/ui/a.pdf?ui=gluon',
        { kind: 'repository', server: 'local', repository: 'game', object: { kind: 'changeset', id: 2 }, page: { kind: 'browse', path: '/ui/a.pdf' } },
      ],
      ['uvcs://acme.cloud/repos/documentation%2fdoc/changesets/1/diff', { ...game, server: 'acme@cloud', repository: 'documentation/doc', object: { kind: 'changeset', id: 1 } }],
      ['uvcs://localhost:8084/repos/codice/theme/changesets/1/diff', { kind: 'repository', server: 'localhost:8084', repository: 'codice/theme', object: { kind: 'changeset', id: 1 } }],
      ['uvcs://ssl://host:8088/repos/game/changesets/5/diff', { kind: 'repository', server: 'host:8088', repository: 'game', object: { kind: 'changeset', id: 5 } }],
      ['uvcs://showchangeset=cs%3A12%40game%40acme%40cloud', { ...game, server: 'acme@cloud', object: { kind: 'changeset', id: 12 } }],
      ['uvcs://showbranch=br:/main/scm24652@game@acme@cloud', { ...game, server: 'acme@cloud', object: { kind: 'branch', name: '/main/scm24652' } }],
      ['plastic://diffbranch=br:/main@rep:game@repserver:skull:9095', { kind: 'repository', server: 'skull:9095', repository: 'game', object: { kind: 'branch', name: '/main' } }],
    ])('%s', (text, link) => {
      expect(parseLink(text)).toEqual({ link });
    });
  });

  describe('what it refuses', () => {
    it.each(['https://example.com', 'cs:12@game@local', '', 'uvcs:game'])('%j is no link', (text) => {
      expect(parseLink(text)).toEqual({ problem: { kind: 'notALink' } });
    });

    it.each([
      'uvcs://acme.unity/projects',
      'uvcs://acme.unity/projects/%22Racing',
      'uvcs://acme.cloud/projects/Racing',
      'uvcs://host:8087/projects/Racing',
      'uvcs://acme.unity/branches/main',
      'uvcs://acme.unity/repos',
      'uvcs://acme.unity/repos/game/changesets/abc',
      'uvcs://acme.unity/repos/game/changesets/1..x',
      'uvcs://acme.unity/repos/game/branches',
      'uvcs://acme.unity/repos/game/branches/main//x',
      'uvcs://acme.unity/repos/game/labels/a..b..c',
      'uvcs://acme.unity/repos/game/shelves/x',
      'uvcs://acme.unity/repos/game/code-reviews/-3',
      'uvcs://acme.unity/repos/game/changesets/1/-/files',
      'uvcs://acme.unity/repos/game/changesets/1/-/files/a/../../b',
      'uvcs://acme.unity/repos/game/changesets/1/-/files/%E0%A4%A',
      'uvcs://acme.unity/repos/game/changesets/1/-/',
      'uvcs://acme.unity/repos/game/changesets/1#L9-L3',
      'uvcs://acme.unity/repos/game/changesets/1#L0',
      'uvcs://acme.unity/repos/game/changesets/1\n--inspect',
      'uvcs://acme.unity/repos/game/changesets/1" --inspect',
      'uvcs:///',
      'uvcs://showchangeset=cs:12',
      // What decoding brings back must hold to the same rules as what's written: no line breaks, quotes, or a path
      // stepping out through an encoded separator.
      'uvcs://acme.unity/repos/game/changesets/1/-/files/a%0A--inspect',
      'uvcs://acme.unity/repos/game/changesets/1/-/files/a%22b',
      'uvcs://acme.unity/repos/game/changesets/1/-/files/a%2F..%2F..%2Fb',
      'uvcs://acme.unity/repos/game/changesets/1/-/files/a%5C..%5Cb',
      'uvcs:///wk/game/-/history/..%2F..%2Fetc%2Fhosts',
      'uvcs://acme.unity/repos/game/branches/main%2F..%2Fx',
      'uvcs://acme.unity/repos/game/changesets/99999999999999999999999',
      `uvcs://acme.unity/repos/game/-/files/${'a/'.repeat(5000)}`,
    ])('%j is malformed', (text) => {
      expect(parseLink(text)).toMatchObject({ problem: { kind: 'malformed' } });
    });

    // A link a later version writes may name what this one doesn't know: the app says it may need an update.
    it.each([
      'uvcs://acme.unity/repos/game/attributes/3',
      'uvcs://acme.unity/repos/game/changesets/1/comments',
      'uvcs://acme.unity/repos/game/changesets/1/-/timeline',
      'uvcs://acme.unity/repos/game/shelves/1/-/browse',
      'uvcs://acme.unity/repos/game/-/locks/a.cs',
      'uvcs://acme.unity/repos/game/-/dashboard',
      'uvcs:///wk/game/-/browse/a.cs',
      'uvcs://acme.unity/repos/game/changesets/1/-/branch-explorer/x',
      'uvcs://acme.unity/projects/Racing/members',
    ])('%j names something this version does not know', (text) => {
      expect(parseLink(text)).toMatchObject({ problem: { kind: 'unknown' } });
    });
  });
});

describe('writesAsLink', () => {
  it("can't name a file, branch or label holding a quote, a line break or a backslash: parseLink would refuse it", () => {
    expect(writesAsLink({ ...game, object: { kind: 'changeset', id: 1 }, page: { kind: 'diffFile', path: '/docs/say "hi".md' } })).toBe(false);
    expect(writesAsLink({ ...game, object: { kind: 'changeset', id: 1 }, page: { kind: 'diffFile', path: '/a\\b.cs' } })).toBe(false);
    expect(writesAsLink({ ...game, object: { kind: 'labelRange', from: 'v1', to: 'v2\n' } })).toBe(false);
  });

  it('names everything else, as it reads back', () => {
    const link = { ...game, object: { kind: 'branch', name: '/main/Mi rama (2)' }, page: { kind: 'diffFile', path: "/it's a file.cs" } } as const;
    expect(writesAsLink(link)).toBe(true);
    expect(parseLink(formatLink(link))).toEqual({ link });
  });
});
