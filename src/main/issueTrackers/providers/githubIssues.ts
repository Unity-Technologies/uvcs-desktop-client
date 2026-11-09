import type { Issue, IssueRead, IssueStatusCategory, TrackerAccount } from '@shared/domain/issueTrackers';
import { githubKey, githubKeyParts } from '@shared/issueTrackers/grammars/github';
import { isRecord, ISSUE_SEARCH_LIMIT, numberOf, stringOf } from './IssueTrackerProvider';

const ISSUE_FIELDS = 'number title url state stateReason assignees(first: 1) { nodes { login name } }';
const PULL_REQUEST_FIELDS = 'number title url state isDraft merged assignees(first: 1) { nodes { login name } }';

/** The repositories a batch names, each an alias (`r0`) holding its issues' aliases (`i0`), and the keys by alias. */
export interface GithubIssuesQuery {
  query: string;
  variables: Record<string, string>;
  /** `r0.i1` → `acme/game#12`; `r0` → the repository's keys. */
  keysByPath: Map<string, string[]>;
  /** The keys asked, in their order: the reads come back in it. */
  keys: string[];
}

/**
 * One GraphQL query for every key: a `repository` alias per repository and an `issueOrPullRequest` alias per issue, as
 * `#12` may be a pull request. Owners and names go in as variables, never into the query's text.
 */
export function githubIssuesQuery(keys: readonly string[]): GithubIssuesQuery {
  const byRepository = new Map<string, { owner: string; name: string; numbers: { key: string; number: number }[] }>();
  for (const key of keys) {
    const parts = githubKeyParts(key);
    if (!parts) continue;
    const id = `${parts.owner}/${parts.name}`;
    const entry = byRepository.get(id) ?? { owner: parts.owner, name: parts.name, numbers: [] };
    entry.numbers.push({ key, number: parts.number });
    byRepository.set(id, entry);
  }
  const variables: Record<string, string> = {};
  const parameters: string[] = [];
  const selections: string[] = [];
  const keysByPath = new Map<string, string[]>();
  [...byRepository.values()].forEach((repository, r) => {
    variables[`o${r}`] = repository.owner;
    variables[`n${r}`] = repository.name;
    parameters.push(`$o${r}: String!`, `$n${r}: String!`);
    keysByPath.set(`r${r}`, repository.numbers.map(({ key }) => key));
    const issues = repository.numbers.map(({ key, number }, i) => {
      keysByPath.set(`r${r}.i${i}`, [key]);
      return `i${i}: issueOrPullRequest(number: ${number}) { __typename ...IssueFields ...PullRequestFields }`;
    });
    selections.push(`r${r}: repository(owner: $o${r}, name: $n${r}) { ${issues.join(' ')} }`);
  });
  const query = [
    `query Issues(${parameters.join(', ')}) { ${selections.join(' ')} }`,
    `fragment IssueFields on Issue { ${ISSUE_FIELDS} }`,
    `fragment PullRequestFields on PullRequest { ${PULL_REQUEST_FIELDS} }`,
  ].join('\n');
  return { query, variables, keysByPath, keys: keys.filter((key) => githubKeyParts(key) !== null) };
}

/**
 * A search of issues (`githubSearchQuery`, as `$q`), each with its repository, so its key is known. The limit is the
 * app's own number, written in; the user's words only ever go in the variable.
 */
export const GITHUB_SEARCH = `query Search($q: String!) { search(type: ISSUE, query: $q, first: ${ISSUE_SEARCH_LIMIT}) { nodes { __typename ... on Issue { ${ISSUE_FIELDS} repository { nameWithOwner } } } } }`;

/** The issues a search found, in its order, each keyed `owner/repo#12` by its repository. */
export function githubFoundIssues(body: Record<string, unknown>, server: string): Issue[] {
  const search = isRecord(body.data) && isRecord(body.data.search) ? body.data.search : {};
  const nodes = Array.isArray(search.nodes) ? search.nodes : [];
  return nodes.flatMap((node) => {
    if (!isRecord(node) || !isRecord(node.repository)) return [];
    const [owner, name] = (stringOf(node.repository.nameWithOwner) ?? '').split('/');
    const number = numberOf(node.number);
    if (!owner || !name || number === undefined) return [];
    return githubIssue(node, githubKey(owner, name, number), server) ?? [];
  });
}

interface GraphqlError {
  type?: string;
  path?: unknown[];
}

/** GitHub's GraphQL errors, by the type it names (`NOT_FOUND`, `RATE_LIMITED`, `FORBIDDEN`). */
export function graphqlErrors(body: Record<string, unknown>): GraphqlError[] {
  return Array.isArray(body.errors) ? body.errors.filter(isRecord).map((error) => ({ type: stringOf(error.type), path: Array.isArray(error.path) ? error.path : undefined })) : [];
}

/** Whether GitHub's GraphQL said, with a 200, that its rate limit was reached. */
export function isGraphqlRateLimited(body: Record<string, unknown>): boolean {
  return graphqlErrors(body).some((error) => error.type === 'RATE_LIMITED');
}

/**
 * What the batch answered for each key (docs/features/issue-trackers.md, "Errors"): an alias with its issue is found;
 * a null issue whose error is `NOT_FOUND` is missing; a null repository (`NOT_FOUND` at `r0`) is one the token can't
 * see, so its keys are no access; any other error at a path is that key's, unreadable this time.
 */
export function githubIssueReads(body: Record<string, unknown>, batch: GithubIssuesQuery, server: string): IssueRead[] {
  const reads = new Map(readsByAlias(body, batch, server).map((read) => [read.key, read]));
  return batch.keys.flatMap((key) => reads.get(key) ?? []);
}

function readsByAlias(body: Record<string, unknown>, batch: GithubIssuesQuery, server: string): IssueRead[] {
  const data = isRecord(body.data) ? body.data : {};
  const errorAt = new Map(graphqlErrors(body).flatMap((error) => (error.path ? [[error.path.join('.'), error.type ?? '']] : [])));
  const reads: IssueRead[] = [];
  for (const [path, keys] of batch.keysByPath) {
    const [repositoryAlias, issueAlias] = path.split('.');
    const repository = data[repositoryAlias!];
    if (!issueAlias) {
      if (!isRecord(repository)) reads.push(...keys.map((key): IssueRead => (errorAt.has(path) ? { key, kind: 'noAccess' } : { key, kind: 'unreadable', reason: 'unexpected' })));
      continue;
    }
    if (!isRecord(repository)) continue;
    const key = keys[0]!;
    const issue = githubIssue(repository[issueAlias], key, server);
    if (issue) reads.push({ key, kind: 'found', issue });
    else reads.push(errorAt.get(path) === 'NOT_FOUND' || !errorAt.has(path) ? { key, kind: 'missing' } : { key, kind: 'unreadable', reason: 'unexpected' });
  }
  return reads;
}

/** An issue or pull request as the batch's fragments read it. */
export function githubIssue(raw: unknown, key: string, server: string): Issue | null {
  if (!isRecord(raw) || numberOf(raw.number) === undefined) return null;
  const pullRequest = raw.__typename === 'PullRequest';
  const { status, statusCategory } = pullRequest ? pullRequestStatus(raw) : issueStatus(raw);
  const parts = githubKeyParts(key);
  return {
    key: parts ? githubKey(parts.owner, parts.name, parts.number) : key,
    title: stringOf(raw.title) ?? '',
    status,
    statusCategory,
    type: pullRequest ? 'Pull request' : 'Issue',
    assignee: firstAssignee(raw.assignees),
    url: stringOf(raw.url) ?? server,
  };
}

/** An issue is open or closed, and why closed: done as completed, canceled as not planned or a duplicate. */
function issueStatus(raw: Record<string, unknown>): { status: string; statusCategory: IssueStatusCategory } {
  if (raw.state !== 'CLOSED') return { status: 'Open', statusCategory: 'todo' };
  const reason = stringOf(raw.stateReason);
  return reason === 'NOT_PLANNED' || reason === 'DUPLICATE' ? { status: 'Closed', statusCategory: 'canceled' } : { status: 'Closed', statusCategory: 'done' };
}

/** A pull request is in progress while open (a draft too), done when merged, canceled when closed unmerged. */
function pullRequestStatus(raw: Record<string, unknown>): { status: string; statusCategory: IssueStatusCategory } {
  if (raw.merged === true || raw.state === 'MERGED') return { status: 'Merged', statusCategory: 'done' };
  if (raw.state === 'CLOSED') return { status: 'Closed', statusCategory: 'canceled' };
  return raw.isDraft === true ? { status: 'Draft', statusCategory: 'inProgress' } : { status: 'Open', statusCategory: 'inProgress' };
}

function firstAssignee(assignees: unknown): TrackerAccount | null {
  const nodes = isRecord(assignees) && Array.isArray(assignees.nodes) ? assignees.nodes : [];
  const first: unknown = nodes[0];
  if (!isRecord(first)) return null;
  const login = stringOf(first.login) ?? '';
  return { id: login, name: stringOf(first.name) || login };
}
