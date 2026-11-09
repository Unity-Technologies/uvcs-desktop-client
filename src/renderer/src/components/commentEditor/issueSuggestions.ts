import type { Issue, IssueRead, IssueSearchAnswer } from '@shared/domain/issueTrackers';
import type { IssueReferenceReader } from '@shared/issueTrackers/issueReferences';
import { indexCandidates, rankCandidates } from '../../lib/candidateRanking';
import { SUGGESTION_LIMIT, suggestionDetail, type Suggestion } from './suggestionItems';
import type { SuggestionRow } from './suggestionRows';

/** Words are searched on the tracker from this many characters: one or two find half the tracker. */
export const ISSUE_WORDS_MIN_LENGTH = 3;

/** A search's answer stays fresh this long: the list a `#` opens on is read again only after it. */
export const ISSUE_SEARCH_FRESH_MS = 60_000;

/** A failed search is tried again after this long at most, sooner when the tracker's rate limit ends sooner. */
export const ISSUE_SEARCH_RETRY_MS = 30_000;

/** How many characters of an issue's title a row shows beside its key, its match kept within them. */
const TITLE_ROOM = 40;

/** What the list asks the tracker for besides the account's open issues, which it always reads. */
export interface IssueSuggestionReads {
  /** A title search, of the words typed. */
  words: string | null;
  /** One issue, by the key typed (`keyTyped`), through the batched reads, never a search. */
  key: string | null;
}

/**
 * What the issue list reads (docs/features/issue-trackers.md, "Suggesting issues"), only once typing settles (`settled`
 * is the text typed, `SERVER_SEARCH_DELAY_MS` later): a key or a number names one issue, read by key; words from
 * `ISSUE_WORDS_MIN_LENGTH` characters are searched. Never one request per key pressed.
 */
export function issueSuggestionReads(reader: Pick<IssueReferenceReader, 'keyTyped'>, typed: string, settled: string): IssueSuggestionReads {
  if (typed === '' || settled !== typed) return { words: null, key: null };
  const key = reader.keyTyped(typed);
  if (key) return { words: null, key };
  return { words: /^\d+$/.test(typed) || typed.length < ISSUE_WORDS_MIN_LENGTH ? null : typed, key: null };
}

/** A search as the list reads it: its answer, and whether one is on its way. */
export interface SearchRead {
  answer: IssueSearchAnswer | undefined;
  pending: boolean;
}

/** What the issue list is made of. */
export interface IssueListState {
  typed: string;
  reader: Pick<IssueReferenceReader, 'referenceText' | 'keyTyped'>;
  trackerName: string;
  /** The connection's credential is refused or missing: nothing is asked. */
  needsSignIn: boolean;
  /** The account's open issues, which the list opens on and filters as the user types. */
  mine: SearchRead;
  /** The title search of the words typed, once asked. */
  words: SearchRead | null;
  /** The issue the key typed names, once asked. */
  keyed: { key: string; read: IssueRead | undefined } | null;
}

/**
 * The issue list's rows (docs/features/issue-trackers.md, "Suggesting issues"): the issue a key typed names first, then
 * the account's open issues that hold what's typed, then what the title search found, each once, the best
 * `SUGGESTION_LIMIT`. With nothing to pick, one quiet row says why: reading, nothing found, the search failed, or the
 * sign-in needs renewing. A row that says why is never picked: Enter stays a line end and typing goes on as text.
 */
export function issueSuggestionRows(state: IssueListState): SuggestionRow[] {
  const { trackerName } = state;
  if (state.needsSignIn || refused(state.mine) || refused(state.words)) return [{ kind: 'note', text: `Sign in to ${trackerName} again in Settings` }];
  const picks = issueSuggestions(state).map((suggestion): SuggestionRow => ({ kind: 'pick', suggestion }));
  const failed = failedSearch(state.mine) || failedSearch(state.words);
  if (picks.length > 0) return failed ? [...picks, { kind: 'note', text: `Couldn't search ${trackerName}` }] : picks;
  if (isPending(state)) return [{ kind: 'note', text: 'Reading issues…', pending: true }];
  if (failed) return [{ kind: 'note', text: `Couldn't search ${trackerName}` }];
  if (state.keyed?.read?.kind === 'missing') return [{ kind: 'note', text: `No issue ${state.keyed.key}` }];
  return [{ kind: 'note', text: state.typed ? `No issues match “${state.typed}”` : 'No open issues assigned to you' }];
}

/** The issues the list offers, as picks, each written as the place's comments read it back (`referenceText`). */
function issueSuggestions(state: IssueListState): Suggestion[] {
  const keyed = state.keyed?.read?.kind === 'found' ? [state.keyed.read.issue] : [];
  const mine = foundIn(state.mine);
  const index = indexCandidates(mine, (issue) => issueNames(issue, state.reader), (issue) => [issue.key, issue.title]);
  const matching = rankCandidates(index, state.typed, SUGGESTION_LIMIT);
  const searched = foundIn(state.words);
  const seen = new Set<string>();
  const offered: Issue[] = [];
  for (const issue of [...keyed, ...matching, ...searched]) {
    if (seen.has(issue.key)) continue;
    seen.add(issue.key);
    offered.push(issue);
  }
  return offered.slice(0, SUGGESTION_LIMIT).map((issue) => issueSuggestion(issue, state.reader, state.typed));
}

/** What a pick of `issue` shows and writes: its reference as the comments read it, its title, its status's dot. */
export function issueSuggestion(issue: Issue, reader: Pick<IssueReferenceReader, 'referenceText'>, typed = ''): Suggestion {
  const written = reader.referenceText(issue.key);
  return { key: `issue:${issue.key}`, kind: 'issue', label: written, detail: suggestionDetail(issue.title, typed, TITLE_ROOM), category: issue.statusCategory, insert: written, issue };
}

/** What names an issue as typed after `#`: its key, its reference as written, its number. */
function issueNames(issue: Issue, reader: Pick<IssueReferenceReader, 'referenceText'>): string[] {
  const number = /(\d+)$/.exec(issue.key)?.[1];
  return [issue.key, reader.referenceText(issue.key).replace(/^#/, ''), ...(number ? [number] : [])];
}

function foundIn(read: SearchRead | null): Issue[] {
  return read?.answer?.kind === 'found' ? read.answer.issues : [];
}

function refused(read: SearchRead | null): boolean {
  return read?.answer?.kind === 'failed' && read.answer.reason === 'signInRefused';
}

function failedSearch(read: SearchRead | null): boolean {
  return read?.answer?.kind === 'failed';
}

/** Something is on its way: a search asked, one a newer one replaced (asked again), or the issue a key names. */
function isPending(state: IssueListState): boolean {
  const waiting = (read: SearchRead | null) => read !== null && (read.pending || read.answer?.kind === 'superseded');
  return waiting(state.mine) || waiting(state.words) || (state.keyed !== null && state.keyed.read === undefined);
}

/**
 * How long a search's answer stays fresh: a minute when it found something; a failure until it may be tried again
 * (`ISSUE_SEARCH_RETRY_MS`, or the end of the tracker's rate limit if sooner); one a newer search replaced, not at all.
 */
export function issueSearchStaleTime(answer: IssueSearchAnswer | undefined, now: number): number {
  switch (answer?.kind) {
    case 'found':
      return ISSUE_SEARCH_FRESH_MS;
    case 'failed':
      return answer.retryAt === undefined ? ISSUE_SEARCH_RETRY_MS : Math.max(0, Math.min(ISSUE_SEARCH_RETRY_MS, answer.retryAt - now));
    default:
      return 0;
  }
}
