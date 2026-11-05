import { isPlausibleToken, REFERENCE_END, REFERENCE_START, type FoundIssueReference, type TrackerGrammar } from '../trackerGrammar';

/** An owner's and a repository's names, as GitHub allows them. */
const OWNER = '[A-Za-z0-9][A-Za-z0-9-]*';
const REPOSITORY = '[A-Za-z0-9._-]+';
/**
 * A repository's name in a sentence, with no dot: `docs/a.md#12` is a file's heading, not an issue. A repository whose
 * name holds one is named by its issue's address instead.
 */
const REPOSITORY_IN_TEXT = '[A-Za-z0-9_-]+';

/** `/owner/repo/issues/12` or `/owner/repo/pull/12`, the pages that name one issue. */
const ISSUE_PATH = new RegExp(`^/(${OWNER})/(${REPOSITORY})/(?:issues|pull)/([1-9]\\d*)/?$`);
const REPOSITORY_PATH = new RegExp(`^/(${OWNER})/(${REPOSITORY})(?:/.*)?$`);

/** `owner/repo#12`, another repository's issue on the same server. */
const QUALIFIED = new RegExp(`${REFERENCE_START}(${OWNER})/(${REPOSITORY_IN_TEXT})#([1-9]\\d*)${REFERENCE_END}`, 'gu');
/** `#12`, the bound repository's issue. */
const BARE = new RegExp(`${REFERENCE_START}#([1-9]\\d*)${REFERENCE_END}`, 'gu');

/**
 * GitHub's tokens by their prefixes: classic (`ghp_`), fine-grained (`github_pat_`), and OAuth's (`gho_`, `ghu_`), which
 * a user may paste from another tool.
 */
const GITHUB_TOKEN = /^(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})$/;

/** GitHub with data residency: `<name>.ghe.com`, its API at `api.<name>.ghe.com`. */
const DATA_RESIDENCY = /^([a-z0-9-]+)\.ghe\.com$/i;

/** The canonical key of an issue of `owner/repo`: lower case, as GitHub compares names. */
export function githubKey(owner: string, repository: string, number: number | string): string {
  return `${owner.toLowerCase()}/${repository.toLowerCase()}#${number}`;
}

/** `acme/game#12` read back: its repository and number. */
export function githubKeyParts(key: string): { owner: string; name: string; number: number } | null {
  const match = /^([^/]+)\/([^#]+)#(\d+)$/.exec(key);
  return match ? { owner: match[1]!, name: match[2]!, number: Number(match[3]) } : null;
}

/** Where a GitHub server's REST API is: `api.github.com`, `api.<name>.ghe.com`, or Enterprise Server's `/api/v3`. */
export function githubApiBase(server: string): string {
  const host = new URL(server).hostname.toLowerCase();
  if (host === 'github.com') return 'https://api.github.com';
  const residency = DATA_RESIDENCY.exec(host);
  if (residency) return `https://api.${residency[1]!.toLowerCase()}.ghe.com`;
  return `${server}/api/v3`;
}

/** Where a GitHub server's GraphQL API is. */
export function githubGraphqlUrl(server: string): string {
  const base = githubApiBase(server);
  return base.endsWith('/api/v3') ? `${server}/api/graphql` : `${base}/graphql`;
}

/** Whether a GitHub server is GitHub's own (github.com or a data residency host), not an Enterprise Server. */
export function isGitHubCloud(server: string): boolean {
  const host = new URL(server).hostname.toLowerCase();
  return host === 'github.com' || DATA_RESIDENCY.test(host);
}

export const githubGrammar: TrackerGrammar = {
  kind: 'github',
  name: 'GitHub',

  recognize(url) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    const cloud = host === 'github.com' || DATA_RESIDENCY.test(host);
    // github.com is always https; an Enterprise Server keeps what the link says, so main can refuse `http:`.
    const server = cloud ? `https://${host}` : `${url.protocol}//${url.host.toLowerCase()}`;
    const issue = ISSUE_PATH.exec(url.pathname);
    if (issue) {
      const [, owner, repository, number] = issue;
      return { kind: 'github', server, project: `${owner!.toLowerCase()}/${repository!.toLowerCase()}`, key: githubKey(owner!, repository!, number!), shows: 'issuePage' };
    }
    // Any other host's page is GitHub's only when it is an issue's: its other pages look like any web page.
    if (!cloud) return null;
    return { kind: 'github', notAnIssue: REPOSITORY_PATH.test(url.pathname) ? 'a GitHub repository' : 'a GitHub page' };
  },

  referencesIn(text, projects) {
    const found: FoundIssueReference[] = [];
    for (const match of text.matchAll(QUALIFIED)) {
      found.push({ key: githubKey(match[1]!, match[2]!, match[3]!), bare: false, source: match[0], from: match.index, to: match.index + match[0].length });
    }
    // `#12` names the bound repository's issue only when there is one: with several, which it means is a guess.
    const only = projects.length === 1 ? projects[0]!.split('/') : null;
    if (only?.length === 2) {
      for (const match of text.matchAll(BARE)) {
        found.push({ key: githubKey(only[0]!, only[1]!, match[1]!), bare: true, source: match[0], from: match.index, to: match.index + match[0].length });
      }
    }
    return found.sort((a, b) => a.from - b.from);
  },

  issueUrl(server, key) {
    const parts = githubKeyParts(key);
    // GitHub sends `/issues/12` on to `/pull/12` when it's a pull request.
    return parts ? `${server}/${parts.owner}/${parts.name}/issues/${parts.number}` : server;
  },

  tokenPageUrl: (server) => `${server}/settings/tokens/new?scopes=repo&description=${encodeURIComponent('UVCS Desktop')}`,

  tokenShape(token) {
    if (GITHUB_TOKEN.test(token)) return 'known';
    return isPlausibleToken(token) ? 'plausible' : 'none';
  },
};
