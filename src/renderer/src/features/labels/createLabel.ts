import type { CreateLabelRequest } from '@shared/api/labels';
import type { Place, WorkspacePlace } from '@shared/domain/place';
import { spec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByLabels } from '../../app/refresh/refreshScopes';
import { switchWorkspace } from '../../app/shell/workspaceOperations';
import { toast } from '../../ui/toast/toastStore';

/** Whether the new label dialog offers to switch to the label: only a workspace switches, a repository explored without one has none. */
export function offersSwitchToNewLabel(place: Place): place is WorkspacePlace {
  return place.kind === 'workspace';
}

/**
 * Creates the label, then, when asked and the place has a workspace (`offersSwitchToNewLabel`), switches it to the
 * label. `onCreated` runs as soon as the label exists, before the switch: the dialog closes, and the switch's own
 * questions (pending changes) show alone. A failure is shown, and leaves the dialog open.
 */
export async function createLabel(place: Place, request: CreateLabelRequest, { switchAfter, onCreated }: { switchAfter: boolean; onCreated: () => void }): Promise<void> {
  const created = await runVoidAction(place, "Couldn't create the label", () => api.labels.create(place, request), isAffectedByLabels);
  if (!created) return;
  onCreated();
  toast.success(`Created label ${request.name}`);
  if (switchAfter && offersSwitchToNewLabel(place)) await switchWorkspace(place.workspacePath, spec.label(request.name), `label ${request.name}`);
}
