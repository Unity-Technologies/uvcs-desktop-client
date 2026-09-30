import type { RestoredChanges } from '@shared/domain/switchWithChanges';
import type { OperationContext } from '../operations/OperationTracker';
import type { SettingsStore } from '../settings/SettingsStore';
import type { LeftChangesFinder } from './leftChanges';

/**
 * Coming back to where changes were left: restores them right away when the setting allows it,
 * this app left exactly one set of changes here, and they apply without conflicts. Otherwise the banner offers them.
 * The switch is done by then: any failure only leaves the choice to the banner.
 */
export async function restoreOnArrival(
  { settings, leftChanges }: { settings: SettingsStore; leftChanges: LeftChangesFinder },
  workspacePath: string,
  context: OperationContext,
): Promise<RestoredChanges | undefined> {
  if (!settings.get().restoreLeftChangesAutomatically) return undefined;
  try {
    // Only this app's own left changes are restored: without any waiting here, the server has nothing to tell.
    if (!(await leftChanges.hasOwnWaiting(workspacePath))) return undefined;
    const left = await leftChanges.find(workspacePath);
    const [only] = left;
    if (left.length !== 1 || !only || only.foreign || only.mode !== 'leave') return undefined;

    context.reportProgress('Restoring the changes you left here…');
    const result = await leftChanges.restore(workspacePath, only.shelveId, context);
    return result.kind === 'restored' ? { count: result.count } : undefined;
  } catch {
    return undefined;
  }
}
