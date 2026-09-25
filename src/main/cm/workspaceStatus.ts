import type { SelectorKind, WorkspaceSelector } from '@shared/domain/workspace';
import type { CmClient } from './CmClient';
import { child, integer, parseXml, text } from './parseXml';

const SELECTOR_KINDS: Record<string, SelectorKind> = {
  Branch: 'branch',
  Changeset: 'changeset',
  Label: 'label',
  Shelve: 'shelve',
};

export interface WorkspaceStatus {
  repositoryName: string;
  server: string;
  selector: WorkspaceSelector;
  loadedChangeset: number;
}

/** What the workspace is loaded from, read with `cm status --header --xml`. */
export async function readWorkspaceStatus(cm: CmClient, workspacePath: string): Promise<WorkspaceStatus> {
  const xml = await cm.query(['status', '--header', '--xml'], { cwd: workspacePath });
  const status = child(parseXml(xml, []), 'StatusOutput');
  const workspaceStatus = child(child(status, 'WorkspaceStatus'), 'Status');
  const repSpec = child(workspaceStatus, 'RepSpec');
  const repositoryName = text(repSpec?.Name);
  const configName = text(status?.WkConfigName);

  return {
    repositoryName,
    server: text(repSpec?.Server),
    selector: {
      kind: SELECTOR_KINDS[text(status?.WkConfigType)] ?? 'branch',
      name: configName.slice(0, configName.lastIndexOf(`@${repositoryName}@`)) || configName,
    },
    loadedChangeset: integer(workspaceStatus?.Changeset),
  };
}
