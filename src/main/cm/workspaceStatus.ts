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
  /** Null on a shelve: its tree is no changeset (`WorkspaceInfo.loadedChangeset`). */
  loadedChangeset: number | null;
}

/** What the workspace is loaded from, read with `cm status --header --xml`. */
export async function readWorkspaceStatus(cm: CmClient, workspacePath: string): Promise<WorkspaceStatus> {
  return parseWorkspaceStatus(await cm.query(['status', '--header', '--xml'], { cwd: workspacePath }));
}

/**
 * The header of `cm status --xml`, with or without the changes. Output without the selector or the changeset is an
 * error rather than an empty status: queries built from an empty branch or changeset -1 would read the whole repository.
 */
export function parseWorkspaceStatus(xml: string): WorkspaceStatus {
  const status = child(parseXml(xml, []), 'StatusOutput');
  const workspaceStatus = child(child(status, 'WorkspaceStatus'), 'Status');
  const repSpec = child(workspaceStatus, 'RepSpec');
  const repositoryName = text(repSpec?.Name);
  const server = text(repSpec?.Server);
  const configName = text(status?.WkConfigName);
  const selector: WorkspaceSelector = {
    kind: SELECTOR_KINDS[text(status?.WkConfigType)] ?? 'branch',
    name: configName && selectorName(configName, repositoryName, server),
  };
  const loadedChangeset = repositoryName && configName ? loadedChangesetOf(integer(workspaceStatus?.Changeset, Number.NaN), selector) : undefined;
  if (loadedChangeset === undefined) throw new Error(`Unexpected output from cm status: ${xml.trim().slice(0, 200) || '(empty)'}`);
  return { repositoryName, server, selector, loadedChangeset };
}

/**
 * The loaded changeset `cm status` reports, null on a shelve, undefined when it makes no sense. `cm` keeps shelves as
 * changesets numbered below zero: a workspace on shelve 3 reports changeset -3 (the official client reads a shelve as
 * changeset `-id`). So the shelve's own negated id is no changeset; any other number below zero, or a shelve with a
 * changeset, is output to reject, never a changeset to query from.
 */
export function loadedChangesetOf(changeset: number, selector: WorkspaceSelector): number | null | undefined {
  if (changeset >= 0) return selector.kind === 'shelve' ? undefined : changeset;
  return selector.kind === 'shelve' && changeset === -Number(selector.name) ? null : undefined;
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
