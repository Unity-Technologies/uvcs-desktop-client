import { toast } from '../../ui/toast/toastStore';

/** Workspaces already told, this session, that some of their folders aren't watched. */
const toldPartial = new Set<string>();

export function notePartialWatch(workspacePath: string): void {
  if (toldPartial.has(workspacePath)) return;
  toldPartial.add(workspacePath);
  toast.info("Some folders here aren't watched", 'Edits in them show when you come back to this window, or with Refresh.');
}
