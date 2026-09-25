import type { SwitchResult } from '@shared/domain/switchWithChanges';
import { spec } from '@shared/domain/specs';
import { pluralize } from '../../lib/text';
import type { Toast } from '../../ui/toast/toastStore';
import { navigation } from '../navigation/navigationStore';

/** What to tell the user after a switch, depending on what happened to their changes. */
export function switchToast(result: SwitchResult, targetName: string): Omit<Toast, 'id'> {
  const restoredCount = 'restored' in result ? result.restored?.count : undefined;
  const restored = restoredCount ? `Restored the ${pluralize(restoredCount, 'change')} you left here.` : undefined;
  const viewChanges = { label: 'View', run: () => navigation.goToView('changes') };

  switch (result.kind) {
    case 'switched':
      return restoredCount
        ? { kind: 'success', title: `Switched to ${targetName} and restored the ${pluralize(restoredCount, 'change')} you left here.`, action: viewChanges }
        : { kind: 'success', title: `Switched to ${targetName}` };
    case 'undidUnchangedCheckouts':
      return { kind: 'success', title: `Switched to ${targetName}`, detail: [`Undid ${pluralize(result.count, 'unchanged checkout')}.`, restored].filter(Boolean).join(' ') };
    case 'left':
      return {
        kind: 'success',
        title: `Switched to ${targetName} — your ${pluralize(result.count, 'change')} stayed on ${result.sourceName} (shelve ${result.shelveId}).`,
        detail: restored,
      };
    case 'brought':
      return { kind: 'success', title: `Switched to ${targetName} — your changes came along.`, action: viewChanges };
    case 'bringPending':
      return {
        kind: 'info',
        title:
          result.conflictCount > 0
            ? `Switched to ${targetName}. ${pluralize(result.conflictCount, 'file needs', 'files need')} your decision to bring your changes.`
            : `Switched to ${targetName}, but your changes weren't applied yet.`,
        detail: `They're safe in shelve ${result.shelveId}.`,
        action: {
          label: 'Resolve now',
          run: () => navigation.openPage({ kind: 'merge', request: { kind: 'merge', sourceSpec: spec.shelve(result.shelveId) } }),
        },
      };
  }
}
