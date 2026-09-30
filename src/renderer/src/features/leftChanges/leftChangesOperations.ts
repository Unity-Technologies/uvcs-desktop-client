import type { LeftChanges } from '@shared/domain/switchWithChanges';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runOperation, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByShelveDeletion } from '../../app/refresh/refreshScopes';
import { pluralize } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';

/** Puts left changes back: applied right away when they merge cleanly, otherwise through the merge view. */
export async function restoreLeftChanges(workspacePath: string, left: LeftChanges): Promise<void> {
  const result = await runOperation({
    title: `Restoring your changes from ${left.sourceName}`,
    workspacePath,
    run: (operationId) => api.leftChanges.restore(workspacePath, left.shelveId, operationId),
    cancellable: false,
  });
  if (!result) return;

  switch (result.kind) {
    case 'restored':
      toast.success(restoredMessage(left, result.count, result.sourceName), undefined, {
        label: 'View',
        run: () => navigation.goToView('changes'),
      });
      break;
    case 'pendingChanges':
      toast.info('Your changes weren’t restored', 'Check in, shelve or undo your current changes first, then restore.');
      break;
    case 'conflicts':
      // The shelve is deleted once the merge view applies it.
      navigation.openPage({ kind: 'merge', request: { kind: 'merge', sourceSpec: spec.shelve(result.shelveId) } });
      break;
  }
}

function restoredMessage(left: LeftChanges, count: number, sourceName: string): string {
  return left.reason === 'update' ? `Restored ${pluralize(count, 'change')} you put aside` : `Restored ${pluralize(count, 'change')} you left on ${sourceName}`;
}

export function reviewLeftChanges(left: LeftChanges): void {
  navigation.openPage({ kind: 'diff', title: `Changes left on ${left.sourceName} (shelve ${left.shelveId})`, target: { kind: 'shelve', shelveId: left.shelveId } });
}

export async function discardLeftChanges(workspacePath: string, shelves: LeftChanges[]): Promise<void> {
  const confirmed = await confirm({
    title: shelves.length === 1 ? 'Discard these shelved changes?' : `Discard ${pluralize(shelves.length, 'older shelve')}?`,
    message: shelves.length === 1 ? 'The shelve will be deleted. This can’t be undone.' : 'The shelves will be deleted. This can’t be undone.',
    confirmLabel: 'Discard',
    danger: true,
  });
  if (!confirmed) return;

  const ids = shelves.map((shelve) => shelve.shelveId);
  const discarded = await runVoidAction(workspacePath, "Couldn't discard the shelved changes", () => api.leftChanges.discard(workspacePath, ids), isAffectedByShelveDeletion);
  if (discarded) toast.success(shelves.length === 1 ? `Discarded shelve ${ids[0]}` : `Discarded ${pluralize(ids.length, 'shelve')}`);
}
