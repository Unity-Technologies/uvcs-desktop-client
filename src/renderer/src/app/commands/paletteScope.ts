import { workspacePathOf, type Place } from '@shared/domain/place';
import { KIND_PREFIXES, type PrefixedKind } from '../../lib/kindPrefixes';

/** The kinds of things the palette lists, each in its own section. */
export type SectionId = 'commands' | 'files' | 'branches' | 'labels' | 'workspaces' | 'changesets' | 'shelves' | 'codeReviews' | 'people';

/** Without a search, what is at hand comes first: what you are changing, where, then what you can do. */
export const LIST_ORDER: SectionId[] = ['files', 'branches', 'labels', 'workspaces', 'commands', 'changesets', 'shelves', 'codeReviews', 'people'];

/** What the palette searches: everything, or the one section a prefix narrows it to. */
export type PaletteScope = 'all' | SectionId;

/** The sections a prefix narrows to: all but the workspaces, which are few and found as typed. */
type PrefixedSection = Exclude<SectionId, 'workspaces'>;

/** The section each shared prefix (`KIND_PREFIXES`) narrows the palette to. */
const SECTION_OF_KIND: Record<PrefixedKind, PrefixedSection> = {
  changeset: 'changesets',
  branch: 'branches',
  label: 'labels',
  shelve: 'shelves',
  codeReview: 'codeReviews',
  person: 'people',
};

/** What the scope chips call each section a prefix narrows to (`scopeChipsFor`). */
const SCOPE_LABELS: Record<PrefixedSection, string> = {
  commands: 'Commands',
  files: 'Files',
  changesets: 'Changesets',
  branches: 'Branches',
  labels: 'Labels',
  shelves: 'Shelves',
  codeReviews: 'Code reviews',
  people: 'People',
};

export interface ScopePrefix {
  prefix: string;
  scope: PrefixedSection;
  label: string;
  /** One of the prefixes the comment editor reads too (`KIND_PREFIXES`), not the palette's own. */
  shared: boolean;
}

/**
 * A leading prefix narrows the search to one section: the palette's own `>` commands and `/` files, then the ones the
 * comment editor reads too (`KIND_PREFIXES`: `cs:`, `br:`, `lb:`, `sh:`, `cr:`, `@`), in their order.
 */
export const SCOPE_PREFIXES: readonly ScopePrefix[] = [
  scopePrefix('>', 'commands', false),
  scopePrefix('/', 'files', false),
  ...Object.entries(KIND_PREFIXES).map(([prefix, kind]) => scopePrefix(prefix, SECTION_OF_KIND[kind], true)),
];

function scopePrefix(prefix: string, scope: PrefixedSection, shared: boolean): ScopePrefix {
  return { prefix, scope, label: SCOPE_LABELS[scope], shared };
}

/**
 * The prefixes that work where the palette is open: with no place shown (the home screen) only commands are searched;
 * a repository explored without a workspace has no files; a workspace has every section.
 */
export function offeredPrefixes(shown: Place | null): ScopePrefix[] {
  const inWorkspace = shown !== null && workspacePathOf(shown) !== null;
  return SCOPE_PREFIXES.filter(({ scope }) => (shown === null ? scope === 'commands' : inWorkspace || scope !== 'files'));
}

/**
 * The scope a query asks for and the text to search it for. A prefix counts only at the start, as typed: `cm`'s
 * prefixes are lower case (`CS:12` is searched for as it is, and still finds changeset 12), and one later in the text
 * (`fix br:main`) is text.
 */
export function parseScope(query: string): { scope: PaletteScope; text: string } {
  const trimmed = query.trimStart();
  const found = SCOPE_PREFIXES.find(({ prefix }) => trimmed.startsWith(prefix));
  return found ? { scope: found.scope, text: trimmed.slice(found.prefix.length).trim() } : { scope: 'all', text: query.trim() };
}

export function isInScope(section: SectionId, scope: PaletteScope): boolean {
  return scope === 'all' || scope === section;
}

/** What a section is waiting for: its list still loading, or its server search running or waiting for typing to pause. */
export interface SectionLoad {
  section: SectionId;
  waiting: boolean;
}

/** Whether the palette is still searching: only sections in scope count, so `>` answers at once from the commands. */
export function isSearching(loads: SectionLoad[], scope: PaletteScope): boolean {
  return loads.some(({ section, waiting }) => waiting && isInScope(section, scope));
}
