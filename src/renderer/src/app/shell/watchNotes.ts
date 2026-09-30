import { toast } from '../../ui/toast/toastStore';

/** Workspaces already told, this session, that some of their folders aren't watched. */
const toldPartial = new Set<string>();

export function notePartialWatch(workspacePath: string): void {
  if (toldPartial.has(workspacePath)) return;
  toldPartial.add(workspacePath);
  toast.info("Some folders here aren't watched", 'Edits in them show when you come back to this window, or with Refresh.');
}

/** Workspaces already told, this session, that their watch broke. */
const toldBroken = new Set<string>();

/** The workspace's watch broke once started (`workspaceWatchBroken`): said once, as an error, and nothing else changes. */
export function noteBrokenWatch(workspacePath: string): void {
  if (toldBroken.has(workspacePath)) return;
  toldBroken.add(workspacePath);
  toast.error('Stopped watching this workspace for changes', 'Changes made outside the app show when you come back to this window, or with Refresh.');
}
