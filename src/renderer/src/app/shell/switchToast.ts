import type { SwitchResult } from '@shared/domain/switchWithChanges';
import { spec } from '@shared/domain/specs';
import { pluralize } from '../../lib/text';
import type { OperationSuccess } from '../operations/runOperation';
import { navigation } from '../navigation/navigationStore';

/**
 * What to tell the user after a switch: where the workspace went as the title, what happened to their changes below
 * it. Without anything to say about them, the card's own count of what was written takes that line.
 */
export function switchToast(result: SwitchResult, targetName: string): OperationSuccess {
  const title = `Switched to ${targetName}`;
  const restoredCount = 'restored' in result ? result.restored?.count : undefined;
  const restored = restoredCount ? `Restored the ${pluralize(restoredCount, 'change')} you left here.` : undefined;
  const viewChanges = { label: 'View', run: () => navigation.goToView('changes') };

  switch (result.kind) {
    case 'switched':
      return restored ? { kind: 'success', title, detail: restored, action: viewChanges } : { kind: 'success', title };
    case 'undidUnchangedCheckouts':
      return { kind: 'success', title, detail: sentences(`Undid ${pluralize(result.count, 'unchanged checkout')}.`, restored) };
    case 'left':
      return { kind: 'success', title, detail: sentences(`${yourChanges(result.count)} on ${result.sourceName}, in shelve ${result.shelveId}.`, restored) };
    case 'brought':
      return { kind: 'success', title, detail: 'Your changes came along.', action: viewChanges };
    case 'bringPending':
      return {
        kind: 'info',
        title,
        detail: sentences(
          result.conflictCount > 0
            ? `${pluralize(result.conflictCount, 'file needs', 'files need')} your decision to bring your changes.`
            : 'Your changes weren’t applied yet.',
          `They’re safe in shelve ${result.shelveId}.`,
        ),
        action: {
          label: 'Resolve now',
          run: () => navigation.openPage({ kind: 'merge', request: { kind: 'merge', sourceSpec: spec.shelve(result.shelveId) } }),
        },
      };
  }
}

function yourChanges(count: number): string {
  return count === 1 ? 'Your change stayed' : `Your ${count} changes stayed`;
}

function sentences(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
