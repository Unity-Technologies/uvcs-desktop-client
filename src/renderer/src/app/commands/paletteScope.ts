/** The kinds of things the palette lists, each in its own section. */
export type SectionId = 'commands' | 'files' | 'branches' | 'labels' | 'workspaces' | 'changesets' | 'shelves' | 'codeReviews';

/** Without a search, what is at hand comes first: what you are changing, where, then what you can do. */
export const LIST_ORDER: SectionId[] = ['files', 'branches', 'labels', 'workspaces', 'commands', 'changesets', 'shelves', 'codeReviews'];

/** A leading character narrows the search to one kind of thing: `>` commands, `@` branches & labels, `/` files, `#` changesets. */
export type PaletteScope = 'all' | 'commands' | 'refs' | 'files' | 'changesets';

export const SCOPE_PREFIXES: { prefix: string; scope: Exclude<PaletteScope, 'all'>; hint: string }[] = [
  { prefix: '>', scope: 'commands', hint: 'commands' },
  { prefix: '@', scope: 'refs', hint: 'branches & labels' },
  { prefix: '/', scope: 'files', hint: 'files' },
  { prefix: '#', scope: 'changesets', hint: 'changesets' },
];

const SECTIONS_IN_SCOPE: Record<Exclude<PaletteScope, 'all'>, SectionId[]> = {
  commands: ['commands'],
  refs: ['branches', 'labels'],
  files: ['files'],
  changesets: ['changesets'],
};

export function parseScope(query: string): { scope: PaletteScope; text: string } {
  const trimmed = query.trimStart();
  const scope = SCOPE_PREFIXES.find(({ prefix }) => trimmed.startsWith(prefix))?.scope;
  return scope ? { scope, text: trimmed.slice(1).trim() } : { scope: 'all', text: query.trim() };
}

export function isInScope(section: SectionId, scope: PaletteScope): boolean {
  return scope === 'all' || SECTIONS_IN_SCOPE[scope].includes(section);
}
