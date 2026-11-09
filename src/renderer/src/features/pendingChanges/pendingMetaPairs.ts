import type { PendingChange } from '@shared/domain/pendingChanges';
import { pairUnityMetas, type MetaPairs } from '../../lib/unityMetaPairs';

/** How a change changed, as pairing compares it: a `.meta` joins its asset only when they changed alike, in one changelist. */
function pendingKindOf(change: PendingChange): string {
  return `${change.kinds.join(',')}|${change.changelist ?? ''}`;
}

/** The pending changes with each Unity `.meta` joined to its asset (`pairUnityMetas`). */
export function pairPendingMetas(changes: readonly PendingChange[]): MetaPairs<PendingChange> {
  return pairUnityMetas(changes, (change) => change.path, pendingKindOf);
}
