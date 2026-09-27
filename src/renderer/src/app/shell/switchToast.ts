import type { RenamedPrivateFile, SwitchResult } from '@shared/domain/switchWithChanges';
import { spec } from '@shared/domain/specs';
import { lastSegment } from '../../lib/paths';
import { pluralize } from '../../lib/text';
import type { OperationSuccess } from '../operations/runOperation';
import { navigation } from '../navigation/navigationStore';

/**
 * What to tell the user after a switch: where the workspace went as the title, what happened to their changes (and to
 * private files in the way) below it. Without anything to say about them, the card's own count of what was written
 * takes that line.
 */
export function switchToast(result: SwitchResult, targetName: string): OperationSuccess {
  const ending = changesEnding(result, `Switched to ${targetName}`);
  const renamed = renamedPrivatesNote(result.renamedPrivates);
  return renamed ? { ...ending, detail: sentences(ending.detail, renamed) } : ending;
}

function changesEnding(result: SwitchResult, title: string): OperationSuccess {
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

/** Nothing else shows that `cm` kept a private file under another name, next to the file the switch wrote. */
function renamedPrivatesNote(renamed: RenamedPrivateFile[] = []): string | undefined {
  const [first] = renamed;
  if (!first) return undefined;
  if (renamed.length === 1) return `Your private file ${lastSegment(first.path)} was in the way: it’s kept as ${lastSegment(first.renamedTo)}.`;
  return `${renamed.length} private files were in the way: they’re kept renamed, as name.private.0.`;
}

function yourChanges(count: number): string {
  return count === 1 ? 'Your change stayed' : `Your ${count} changes stayed`;
}

function sentences(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
