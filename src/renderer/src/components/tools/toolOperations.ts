import { workspacePathOf, type Place } from '@shared/domain/place';
import { TOOL_RUNS_WITHOUT_ASKING, type Tool, type ToolSubject } from '@shared/domain/tools';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { runRead } from '../../app/operations/runOperation';
import { queryClient } from '../../app/queryClient';
import { repositoryOfPlace } from '../../app/workspace/placeOrigin';
import { workspaceInfoQuery } from '../../app/workspace/useWorkspace';
import { formatCount } from '../../lib/text';
import { confirm } from '../../ui/dialog/confirm';

/**
 * Runs the tool on each subject, one process each: past `TOOL_RUNS_WITHOUT_ASKING` it asks first. A subject that
 * doesn't name its repository takes the window's, as last read. A failure says which tool.
 */
export async function runToolOn(place: Place, tool: Tool, subjects: ToolSubject[]): Promise<void> {
  if (subjects.length > TOOL_RUNS_WITHOUT_ASKING) {
    const go = await confirm({
      title: `Run ${tool.name} ${formatCount(subjects.length)} times?`,
      message: `It starts once for each of the ${formatCount(subjects.length)} items selected.`,
      confirmLabel: 'Run',
    });
    if (!go) return;
  }
  const repository = placeRepository(place);
  const named = subjects.map((subject) => (subject.repository || !repository ? subject : { ...subject, repository }));
  await runRead(`Couldn't run ${tool.name}`, () => api.tools.run(place, tool.id, named));
}

function placeRepository(place: Place): string | undefined {
  const workspacePath = workspacePathOf(place);
  const info = workspacePath === null ? undefined : queryClient.getQueryData<WorkspaceInfo>(workspaceInfoQuery(workspacePath).queryKey);
  return repositoryOfPlace(place, info);
}
