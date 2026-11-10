import type { WorkspaceKind } from '@shared/domain/workspace';

/** The `cm getworkspacefrompath --format` keywords telling how a workspace holds its files. */
export const WORKSPACE_KIND_FIELDS = ['type', 'dynamic'] as const;

/**
 * A workspace's kind from what `cm getworkspacefrompath` prints for `{type}` (`partial` or `regular`) and `{dynamic}`
 * (`dynamic` or `static`). Dynamic wins: how its files arrive is what the user feels. Undefined when `cm` printed
 * neither kind it knows, so a workspace whose kind wasn't told never shows as standard.
 */
export function workspaceKindOf(type: string, dynamic: string): WorkspaceKind | undefined {
  if (dynamic.trim().toLowerCase() === 'dynamic') return 'dynamic';
  const holds = type.trim().toLowerCase();
  if (holds === 'partial') return 'partial';
  if (holds === 'regular') return 'standard';
  return undefined;
}
