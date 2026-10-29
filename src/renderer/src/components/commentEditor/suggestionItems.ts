import { gemoji, type Gemoji } from 'gemoji';
import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Label } from '@shared/domain/label';
import type { Shelve } from '@shared/domain/shelve';
import { formatLink } from '@shared/links/formatLink';
import { findReferences } from '../../lib/comments/commentReferences';
import { commentLineText, commentText } from '../../lib/comments/commentText';
import { matchWindow } from '../../lib/matchWindow';
import { wordMatchRanges } from '../../lib/textMatchRanges';
import { branchFilterTexts } from '../../features/branches/branchFilters';
import { changesetFilterTexts } from '../../features/changesets/changesetFilters';
import { reviewFilterTexts } from '../../features/codeReviews/codeReviewFilters';
import { labelFilterTexts } from '../../features/labels/labelFilters';
import { shelveFilterTexts } from '../../features/shelves/shelveFilterTexts';
import { lastSegment } from '../../lib/paths';
import { splitRepositorySpec } from '../../lib/servers';

import { displayName, userFilterTexts } from '../../lib/userName';
import { indexCandidates, rankCandidates, type CandidateIndex } from './suggestionRanking';
import type { SuggestionKind } from './suggestionTriggers';

/** How many suggestions a list shows: the best few, never everything (ARCHITECTURE.md "Big lists"). */
export const SUGGESTION_LIMIT = 8;

/** A row of the suggestion list, and what picking it writes. */
export interface Suggestion {
  /** Unique in its list: the option's id. */
  key: string;
  kind: SuggestionKind;
  /** What the row leads with: "4207", "/main/task-2210", "Ana Diaz", ":tada:". */
  label: string;
  /** What describes it, quieter: a comment's first line as text (`commentLineText`), `@ana`, an emoji's description. */
  detail?: string;
  /** Whose avatar leads the row: a person's. */
  person?: string;
  /** Who made it, at the row's end: an object's owner. */
  owner?: string;
  /** An emoji's own glyph, in place of an icon. */
  glyph?: string;
  /** What a pick writes in the comment, a space after it. */
  insert: string;
}

/**
 * Each kind's list read into an index once per read (`indexCandidates`), so a key typed walks no object: by what
 * names it, and by the texts its view's filter looks through (`*FilterTexts`), so the same words find the same objects.
 */
export function changesetIndex(changesets: readonly Changeset[]): CandidateIndex<Changeset> {
  return indexCandidates(changesets, (changeset) => [String(changeset.id)], (changeset) => changesetFilterTexts(changeset));
}

export function branchIndex(branches: readonly Branch[]): CandidateIndex<Branch> {
  // Newest first, as a branch worked on lately is the one a comment most likely names.
  const newest = [...branches].sort(byNewest);
  return indexCandidates(newest, (branch) => [branch.name.replace(/^\//, ''), lastSegment(branch.name)], branchFilterTexts);
}

export function labelIndex(labels: readonly Label[]): CandidateIndex<Label> {
  const newest = [...labels].sort(byNewest);
  return indexCandidates(newest, (label) => [label.name], labelFilterTexts);
}

export function shelveIndex(shelves: readonly Shelve[]): CandidateIndex<Shelve> {
  const newest = [...shelves].sort((a, b) => b.id - a.id);
  return indexCandidates(newest, (shelve) => [String(shelve.id)], shelveFilterTexts);
}

export function codeReviewIndex(reviews: readonly CodeReviewSummary[]): CandidateIndex<CodeReviewSummary> {
  const newest = [...reviews].sort((a, b) => b.id - a.id);
  return indexCandidates(newest, (review) => [String(review.id)], reviewFilterTexts);
}

/** People by how `cm` names them and by the name shown; only those a mention reads back whole (`@ana@acme.com`). */
export function personIndex(people: readonly string[]): CandidateIndex<string> {
  const mentionable = [...new Set(people)].filter((person) => readsBackWhole(`@${person}`));
  return indexCandidates(mentionable, (person) => [person, displayName(person)], userFilterTexts);
}

let emojiIndexOnce: CandidateIndex<Gemoji> | undefined;

/** GitHub's emoji (`gemoji`), by their names first, then their tags: read into an index on the first `:`. */
export function emojiIndex(): CandidateIndex<Gemoji> {
  emojiIndexOnce ??= indexCandidates(gemoji, (emoji) => emoji.names, (emoji) => [...emoji.names, ...emoji.tags]);
  return emojiIndexOnce;
}

/** A branch's query typed with its leading `/` (`br:/main/ta`) looks the names up without it, as they're indexed. */
export function branchQueryText(typed: string): string {
  return typed.replace(/^\//, '');
}

export function changesetSuggestions(index: CandidateIndex<Changeset>, typed: string): Suggestion[] {
  return rankCandidates(index, typed, SUGGESTION_LIMIT).map((changeset) => changesetSuggestion(changeset, typed));
}

export function changesetSuggestion(changeset: Changeset, typed = ''): Suggestion {
  return { key: `cs:${changeset.id}`, kind: 'changeset', label: String(changeset.id), detail: suggestionDetail(changeset.comment, typed), owner: changeset.owner, insert: `cs:${changeset.id}` };
}

/** How many characters of a summary a suggestion's row shows beside its number and its author (about 150 px): its match is kept within them. */
const DETAIL_ROOM = 22;
/** The same beside a branch's or a label's name, which takes most of the row. */
const DETAIL_ROOM_BESIDE_A_NAME = 12;

/**
 * A comment as a suggestion's summary, the words typed in sight (`matchWindow`), as `Highlight` marks them: its first
 * line, or the whole comment on one line when only its body holds them, so the row shows why it was offered.
 */
export function suggestionDetail(comment: string, typed: string, room = DETAIL_ROOM): string {
  const line = commentLineText(comment);
  const whole = commentText(comment).replace(/\s+/g, ' ').trim();
  const bodyOnly = wordMatchRanges(line, typed).length === 0 && wordMatchRanges(whole, typed).length > 0;
  return matchWindow(bodyOnly ? whole : line, typed, room);
}

/** `placeRepository` writes a name a spec can't hold as its link (`objectReferenceText`). */
export function branchSuggestions(index: CandidateIndex<Branch>, typed: string, placeRepository: string | undefined): Suggestion[] {
  return rankCandidates(index, branchQueryText(typed), SUGGESTION_LIMIT).map((branch) => ({
    key: `br:${branch.name}`,
    kind: 'branch',
    label: branch.name,
    detail: suggestionDetail(branch.comment, typed, DETAIL_ROOM_BESIDE_A_NAME),
    owner: branch.owner,
    insert: objectReferenceText({ kind: 'branch', name: branch.name }, placeRepository),
  }));
}

export function labelSuggestions(index: CandidateIndex<Label>, typed: string, placeRepository: string | undefined): Suggestion[] {
  return rankCandidates(index, typed, SUGGESTION_LIMIT).map((label) => ({
    key: `lb:${label.name}`,
    kind: 'label',
    label: label.name,
    detail: suggestionDetail(label.comment, typed, DETAIL_ROOM_BESIDE_A_NAME),
    owner: label.owner,
    insert: objectReferenceText({ kind: 'label', name: label.name }, placeRepository),
  }));
}

export function shelveSuggestions(index: CandidateIndex<Shelve>, typed: string): Suggestion[] {
  return rankCandidates(index, typed, SUGGESTION_LIMIT).map((shelve) => ({
    key: `sh:${shelve.id}`,
    kind: 'shelve',
    label: String(shelve.id),
    detail: suggestionDetail(shelve.comment, typed),
    owner: shelve.owner,
    insert: `sh:${shelve.id}`,
  }));
}

export function codeReviewSuggestions(index: CandidateIndex<CodeReviewSummary>, typed: string): Suggestion[] {
  return rankCandidates(index, typed, SUGGESTION_LIMIT).map((review) => ({
    key: `cr:${review.id}`,
    kind: 'codeReview',
    label: String(review.id),
    detail: suggestionDetail(review.title, typed),
    owner: review.owner,
    insert: `cr:${review.id}`,
  }));
}

export function personSuggestions(index: CandidateIndex<string>, typed: string): Suggestion[] {
  return rankCandidates(index, typed, SUGGESTION_LIMIT).map((person) => ({
    key: `@${person}`,
    kind: 'person',
    label: displayName(person),
    detail: person,
    person,
    insert: `@${person}`,
  }));
}

export function emojiSuggestions(typed: string): Suggestion[] {
  const query = typed.toLowerCase();
  return rankCandidates(emojiIndex(), query, SUGGESTION_LIMIT).map((emoji) => {
    // The name typed, when it's one of the emoji's (`+1` and `thumbsup` are one emoji).
    const name = emoji.names.find((candidate) => candidate.startsWith(query)) ?? emoji.names[0]!;
    // The emoji itself, not its name: it shows at once, and reads so in `cm` and every client that knows no names
    // (gemoji's `emoji`, with its variation selectors and joiners). A name typed out whole stays as typed.
    return { key: `:${name}:`, kind: 'emoji', label: `:${name}:`, detail: emoji.description, glyph: emoji.emoji, insert: emoji.emoji };
  });
}

/**
 * How a comment names a branch or a label: its spec (`br:/main/task`), or its `uvcs://` link when the spec can't hold
 * the name (docs/features/rich-comments.md, "Names with spaces"): a space, a sentence's punctuation or an emphasis
 * mark at its end, which `cm` has no way to quote. Both show as the same chip.
 */
export function objectReferenceText(object: { kind: 'branch' | 'label'; name: string }, placeRepository: string | undefined): string {
  const spec = `${object.kind === 'branch' ? 'br' : 'lb'}:${object.name}`;
  const [found] = findReferences(spec);
  const whole = found && found.from === 0 && found.to === spec.length && 'name' in found.reference && found.reference.name === object.name;
  if (whole || !placeRepository) return spec;
  const { name, server } = splitRepositorySpec(placeRepository);
  return formatLink({ kind: 'repository', server, repository: name, object });
}

/** Whether a reference written as `text` reads back as all of it: a mention of a name `cm` couldn't print otherwise. */
function readsBackWhole(text: string): boolean {
  const found = findReferences(text);
  return found.length === 1 && found[0]!.from === 0 && found[0]!.to === text.length;
}

/** Newest first by the date `cm` prints (ISO 8601): compared as text, the code units' order, never a locale's. */
function byNewest(a: { date: string }, b: { date: string }): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
}
