import type { RevisionRef } from './revision';
import type { SelectorKind, WorkspaceSelector } from './workspace';

/** Helpers to build `cm` object specs. See `cm help objectspec`. */
export const spec = {
  branch: (name: string): string => `br:${name}`,
  /** With `repository` for a changeset of another repository than the workspace's (under an xlink). */
  changeset: (id: number, repository?: string): string => (repository ? `cs:${id}@${repository}` : `cs:${id}`),
  label: (name: string): string => `lb:${name}`,
  shelve: (id: number): string => `sh:${id}`,
  /**
   * Always with its repository: `cm` looks a bare `revid:` up in the workspace's, whose revisions reuse the ids of an
   * xlinked repository's (and `cm annotate` finds no bare id on a cloud server).
   */
  revision: ({ revisionId, repository }: RevisionRef): string => `revid:${revisionId}@${repository}`,
  serverPathAtChangeset: (serverPath: string, changesetId: number): string =>
    `serverpath:${serverPath}#cs:${changesetId}`,
  /** An item of `repository` at any point in its history, given as a changeset or shelve spec (`cs:12`, `sh:3`). */
  itemAt: (itemId: number, pointSpec: string, repository: string): string => `itemid:${itemId}#${pointSpec}@${repository}`,
  serverPathAt: (serverPath: string, pointSpec: string): string => `serverpath:${serverPath}#${pointSpec}`,
};

const SELECTOR_PREFIXES: Record<SelectorKind, string> = { branch: 'br', changeset: 'cs', label: 'lb', shelve: 'sh' };

/** `{ kind: 'branch', name: '/main/t1' }` → `br:/main/t1`. */
export function selectorSpec(selector: WorkspaceSelector): string {
  return `${SELECTOR_PREFIXES[selector.kind]}:${selector.name}`;
}

/**
 * Whether a revision spec is pinned to a changeset or a shelve (`serverpath:/a.ts#cs:12`, `itemid:27#sh:3@game@local`,
 * `src/a.ts#cs:12`) or names a revision (`revid:45@game@local`): what it reads never changes.
 */
export function isPinnedSpec(revisionSpec: string): boolean {
  return /#(?:cs|sh):\d+(?:@[^#]+)?$/.test(revisionSpec) || /^revid:\d+(?:@|$)/.test(revisionSpec);
}

export function repositorySpec(name: string, server: string): string {
  return `${name}@${server}`;
}

export function shortBranchName(fullName: string): string {
  return fullName.split('/').filter(Boolean).at(-1) ?? fullName;
}
