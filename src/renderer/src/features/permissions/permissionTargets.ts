import { serverOfRepository, type PermissionTarget, type PermissionTargetKind } from '@shared/domain/permissions';
import type { Source } from './aclResolution';

export const KIND_WORDS: Record<PermissionTargetKind, string> = {
  server: 'Server',
  repository: 'Repository',
  branch: 'Branch',
  label: 'Label',
  attribute: 'Attribute',
  path: 'Path',
};

/** A repository object (branch, label, attribute) of `repository` (`name@server`). */
export function repositoryObjectTarget(kind: 'branch' | 'label' | 'attribute', name: string, repository: string, knownOwner?: string): PermissionTarget {
  return { kind, server: serverOfRepository(repository), repository, name, ...(knownOwner && { knownOwner }) };
}

export function repositoryTarget(repository: string, knownOwner?: string): PermissionTarget {
  return { kind: 'repository', server: serverOfRepository(repository), repository, name: repository.slice(0, repository.indexOf('@')), ...(knownOwner && { knownOwner }) };
}

export function serverTarget(server: string): PermissionTarget {
  return { kind: 'server', server, name: server };
}

/** A path of `repository`, as the server knows it: from the root, forward slashes (`src/a.ts` → `/src/a.ts`). */
export function pathTarget(repository: string, path: string, tag?: string): PermissionTarget {
  const name = `/${path.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')}`;
  return { kind: 'path', server: serverOfRepository(repository), repository, name, ...(tag?.trim() && { tag: tag.trim() }) };
}

/** What the dialog says it shows: "Branch /main/task · game@local", "Path /src · all branches · game@local". */
export function describeTarget(target: PermissionTarget): string {
  const parts = [`${KIND_WORDS[target.kind]} ${target.name}`];
  if (target.kind === 'path') parts.push(target.tag ? `branches of ${target.tag}` : 'all branches');
  if (target.kind === 'repository') parts.push(target.server);
  else if (target.repository) parts.push(target.repository);
  return parts.join(' · ');
}

/**
 * Where an allow or deny comes from, in words: "here", "the server", "repository game", "branch /main". `creator` is
 * the spec `cm showacl` prints for a list.
 */
export function sourceLabel(source: Source): string {
  if (source === 'here') return 'here';
  if (source.startsWith('repserver:')) return 'the server';
  const prefix = source.slice(0, source.indexOf(':') + 1);
  const rest = source.slice(prefix.length);
  const name = prefix === 'rep:' ? rest.slice(0, rest.indexOf('@repserver:')) : rest.slice(0, Math.max(0, rest.lastIndexOf('@rep:'))) || rest;
  return `${SOURCE_WORDS[prefix] ?? 'object'} ${name}`;
}

const SOURCE_WORDS: Record<string, string> = { 'rep:': 'repository', 'br:': 'branch', 'lb:': 'label', 'att:': 'attribute', 'path:': 'path' };
