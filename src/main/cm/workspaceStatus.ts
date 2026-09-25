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
  return parseWorkspaceStatus(await cm.query(['status', '--header', '--xml'], { cwd: workspacePath }));
}

/**
 * Parses `cm status --header --xml`. Output without the selector or the changeset is an error rather than an empty
 * status: queries built from an empty branch or changeset -1 would ask the server for the whole repository.
 */
export function parseWorkspaceStatus(xml: string): WorkspaceStatus {
  const status = child(parseXml(xml, []), 'StatusOutput');
  const workspaceStatus = child(child(status, 'WorkspaceStatus'), 'Status');
  const repSpec = child(workspaceStatus, 'RepSpec');
  const repositoryName = text(repSpec?.Name);
  const server = text(repSpec?.Server);
  const configName = text(status?.WkConfigName);
  const loadedChangeset = integer(workspaceStatus?.Changeset);
  if (!repositoryName || !configName || loadedChangeset < 0) {
    throw new Error(`Unexpected output from cm status: ${xml.trim().slice(0, 200) || '(empty)'}`);
  }

  return {
    repositoryName,
    server,
    selector: {
      kind: SELECTOR_KINDS[text(status?.WkConfigType)] ?? 'branch',
      name: selectorName(configName, repositoryName, server),
    },
    loadedChangeset,
  };
}

/**
 * `/main/task@codice@codice@cloud` → `/main/task`. The repository spec is removed as a whole
 * suffix, because repository and organization names can repeat (`codice@codice@cloud`).
 */
export function selectorName(configName: string, repositoryName: string, server: string): string {
  for (const suffix of [`@${repositoryName}@${server}`, `@${repositoryName}`]) {
    if (configName.endsWith(suffix)) return configName.slice(0, -suffix.length);
  }
  return configName;
}
