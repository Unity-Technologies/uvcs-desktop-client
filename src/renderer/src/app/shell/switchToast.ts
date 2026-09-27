import type { RenamedPrivateFile, SwitchResult } from '@shared/domain/switchWithChanges';
import { spec } from '@shared/domain/specs';
import { lastSegment } from '../../lib/paths';
import { pluralize } from '../../lib/text';
import type { OperationSuccess } from '../operations/runOperation';
import { navigation } from '../navigation/navigationStore';

/** What to tell the user after a switch, depending on what happened to their changes (and to private files in the way). */
export function switchToast(result: SwitchResult, targetName: string): OperationSuccess {
  const ending = changesEnding(result, targetName);
  const renamed = renamedPrivatesNote(result.renamedPrivates);
  return renamed ? { ...ending, detail: [ending.detail, renamed].filter(Boolean).join(' ') } : ending;
}

/** Nothing else shows that `cm` kept a private file under another name, next to the file the switch wrote. */
function renamedPrivatesNote(renamed: RenamedPrivateFile[] = []): string | undefined {
  const [first] = renamed;
  if (!first) return undefined;
  if (renamed.length === 1) return `Your private file ${lastSegment(first.path)} was in the way: it's kept as ${lastSegment(first.renamedTo)}.`;
  return `${renamed.length} private files were in the way: they're kept renamed, as name.private.0.`;
}

function changesEnding(result: SwitchResult, targetName: string): OperationSuccess {
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
