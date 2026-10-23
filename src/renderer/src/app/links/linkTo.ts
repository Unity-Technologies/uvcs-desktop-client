import type { Place } from '@shared/domain/place';
import type { DiffTarget } from '@shared/domain/diff';
import { formatLink, writesAsLink } from '@shared/links/formatLink';
import type { LinkObject } from '@shared/links/link';
import { splitRepositorySpec } from '../../lib/servers';
import { queryClient } from '../queryClient';
import { workspaceInfoQuery } from '../workspace/useWorkspace';
import type { LinkTarget } from './linkNavigation';

/**
 * The link to what a repository holds (`game@acme@unity`, as `cm` names it): an object, a page in it, lines. The one
 * way the app writes links people share (docs/features/deep-links.md, "Where links are copied").
 */
export function repositoryLinkTo(repository: string, target: LinkTarget): string {
  const { name, server } = splitRepositorySpec(repository);
  return formatLink({ kind: 'repository', server, repository: name, ...target });
}

/** The same in the workspace's repository, from its info (already read: the workspace's window shows it), when it's copied. */
export function workspaceLinkTo(workspacePath: string, target: LinkTarget): () => Promise<string> {
  return async () => repositoryLinkTo((await queryClient.fetchQuery(workspaceInfoQuery(workspacePath))).repository, target);
}

/** The link to a target in the place's repository: a repository's own at once, a workspace's from its info. */
export function placeLinkTo(place: Place, target: LinkTarget): () => Promise<string> {
  return place.kind === 'repository' ? async () => repositoryLinkTo(place.repository, target) : workspaceLinkTo(place.workspacePath, target);
}

/**
 * What a link copies: the object's own repository when known (it may be an xlinked one), else the place's (a
 * repository's own, or a workspace's from its info); null for a name no link can carry (`writesAsLink`).
 */
export function linkCopyText(place: Place, repository: string | undefined, target: LinkTarget): string | (() => Promise<string>) | null {
  if (!isWritable(target)) return null;
  if (repository) return repositoryLinkTo(repository, target);
  return place.kind === 'repository' ? repositoryLinkTo(place.repository, target) : workspaceLinkTo(place.workspacePath, target);
}

/** Whether a link can name the target (`writesAsLink`), whatever repository it's in. */
export function isWritable(target: LinkTarget): boolean {
  return writesAsLink({ kind: 'repository', server: 'local', repository: 'repository', ...target });
}

/** What a diff compares, as a link names it; null for one no link names (two branches' heads, mixed points). */
export function diffTargetObject(target: DiffTarget): LinkObject | null {
  switch (target.kind) {
    case 'changeset':
      return { kind: 'changeset', id: target.changesetId };
    case 'branch':
      return { kind: 'branch', name: target.branch };
    case 'shelve':
      return { kind: 'shelve', id: target.shelveId };
    case 'range':
      return rangeObject(target.fromSpec, target.toSpec);
  }
}

function rangeObject(fromSpec: string, toSpec: string): LinkObject | null {
  const changesets = [/^cs:(\d+)$/.exec(fromSpec)?.[1], /^cs:(\d+)$/.exec(toSpec)?.[1]];
  if (changesets[0] && changesets[1]) return { kind: 'changesetRange', from: Number(changesets[0]), to: Number(changesets[1]) };
  const labels = [/^lb:(.+)$/.exec(fromSpec)?.[1], /^lb:(.+)$/.exec(toSpec)?.[1]];
  if (labels[0] && labels[1]) return { kind: 'labelRange', from: labels[0], to: labels[1] };
  return null;
}
