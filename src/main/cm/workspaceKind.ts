import type { WorkspaceKind } from '@shared/domain/workspace';

/** The `cm getworkspacefrompath --format` keywords telling how a workspace holds its files. */
export const WORKSPACE_KIND_FIELDS = ['type', 'dynamic'] as const;

/**
 * A workspace's kind from what `cm getworkspacefrompath` prints for `{type}` (`partial` or `regular`) and `{dynamic}`
 * (`dynamic` or `static`). Dynamic wins: how its files arrive is what the user feels. Anything else reads as standard,
 * the kind that needs no telling.
 */
export function workspaceKindOf(type: string, dynamic: string): WorkspaceKind {
  if (dynamic.trim().toLowerCase() === 'dynamic') return 'dynamic';
  if (type.trim().toLowerCase() === 'partial') return 'partial';
  return 'standard';
}
