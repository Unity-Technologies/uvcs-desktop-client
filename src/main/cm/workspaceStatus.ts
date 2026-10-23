import type { SelectorKind, WorkspaceSelector } from '@shared/domain/workspace';
import type { CmClient } from './CmClient';
import { isOrganizationIdServer } from './organizationIds';
import { child, integer, parseXml, text } from './parseXml';

const SELECTOR_KINDS: Record<string, SelectorKind> = {
  Branch: 'branch',
  Changeset: 'changeset',
  Label: 'label',
  Shelve: 'shelve',
};

export interface WorkspaceStatus {
  repositoryName: string;
  /** By name, as `cm` prints it almost everywhere (`AcmeStudio@unity` for a Unity organization). */
  server: string;
  selector: WorkspaceSelector;
  /** Null on a shelve: its tree is no changeset (`WorkspaceInfo.loadedChangeset`). */
  loadedChangeset: number | null;
}

/** The header as `cm status --xml` prints it, its server named only by `readWorkspaceStatus`. */
export interface PrintedWorkspaceStatus extends Omit<WorkspaceStatus, 'server'> {
  /** A Unity organization's by its id (`2398571046213@cloud`), which nothing may show, compare or pass to `cm`. */
  printedServer: string;
}

/** What the workspace is loaded from, read with `cm status --header --xml`, its server by name (`serverByName`). */
export async function readWorkspaceStatus(cm: CmClient, workspacePath: string): Promise<WorkspaceStatus> {
  const { printedServer, ...status } = await readStatusHeader(cm, workspacePath);
  return { ...status, server: await serverByName(cm, workspacePath, printedServer, { cwd: workspacePath }) };
}

/**
 * What the workspace has loaded, without its repository: one `cm status --header --xml`, for what needs no more. XML,
 * as `cm status` has no `--format`, and its records (`--machinereadable`) don't name the selector.
 */
export async function readWorkspaceLoad(cm: CmClient, workspacePath: string): Promise<Pick<WorkspaceStatus, 'selector' | 'loadedChangeset'>> {
  const { selector, loadedChangeset } = await readStatusHeader(cm, workspacePath);
  return { selector, loadedChangeset };
}

async function readStatusHeader(cm: CmClient, workspacePath: string): Promise<PrintedWorkspaceStatus> {
  return parseWorkspaceStatus(await cm.query(['status', '--header', '--xml'], { cwd: workspacePath }));
}

/**
 * The workspace's server as `cm` names it everywhere but in `cm status --xml`, which prints a Unity organization's by
 * its id (ARCHITECTURE.md "Unity organizations"). Only then is the workspace's machine-readable header read, a local
 * read that names it, run from `cwd`. Should it fail, the id stays.
 */
async function serverByName(cm: CmClient, workspacePath: string, printedServer: string, { cwd }: { cwd: string }): Promise<string> {
  if (!isOrganizationIdServer(printedServer)) return printedServer;
  const output = await cm.query(machineReadableHeaderArgs(workspacePath), { cwd }).catch(() => '');
  return parseMachineReadableHeader(output)?.server ?? printedServer;
}

/**
 * The header of `cm status --xml`, with or without the changes. Output without the selector or the changeset is an
 * error rather than an empty status: queries built from an empty branch or changeset -1 would read the whole repository.
 */
export function parseWorkspaceStatus(xml: string): PrintedWorkspaceStatus {
  const status = child(parseXml(xml, []), 'StatusOutput');
  const workspaceStatus = child(child(status, 'WorkspaceStatus'), 'Status');
  const repSpec = child(workspaceStatus, 'RepSpec');
  const repositoryName = text(repSpec?.Name);
  const printedServer = text(repSpec?.Server);
  const configName = text(status?.WkConfigName);
  const selector: WorkspaceSelector = {
    kind: SELECTOR_KINDS[text(status?.WkConfigType)] ?? 'branch',
    name: configName && selectorName(configName, repositoryName),
  };
  const loadedChangeset = repositoryName && configName ? loadedChangesetOf(integer(workspaceStatus?.Changeset, Number.NaN), selector) : undefined;
  if (loadedChangeset === undefined) throw new Error(`Unexpected output from cm status: ${xml.trim().slice(0, 200) || '(empty)'}`);
  return { repositoryName, printedServer, selector, loadedChangeset };
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
 * `/main/task@acme@acme@cloud` → `/main/task`: everything from the first `@<repository>@`, whatever server follows
 * (a Unity organization's may be printed by name or by its id, not always as `<RepSpec>` prints it). Names of
 * branches, labels and repositories hold no `@`, so the first is where the repository starts, even when the
 * organization repeats its name (`acme@acme@cloud`).
 */
export function selectorName(configName: string, repositoryName: string): string {
  const repositoryAt = configName.indexOf(`@${repositoryName}@`);
  if (repositoryAt >= 0) return configName.slice(0, repositoryAt);
  return configName.endsWith(`@${repositoryName}`) ? configName.slice(0, -repositoryName.length - 1) : configName;
}

/**
 * `cm status --header --machinereadable` of the workspace at `workspacePath`, a local read with `--compact`
 * (ARCHITECTURE.md "`cm status` asks the server for its header"). Unlike `--xml`, it names a Unity organization's
 * server as people do (`AcmeStudio@unity`), but not what the workspace has loaded.
 */
export function machineReadableHeaderArgs(workspacePath: string): string[] {
  return ['status', '--header', '--machinereadable', '--compact', '--fieldseparator=|', workspacePath];
}

/** `STATUS|<changeset>|<repository>|<server>` from `machineReadableHeaderArgs`; null when it isn't (not a workspace). */
export function parseMachineReadableHeader(output: string): { repositoryName: string; server: string } | null {
  const match = /^STATUS\|-?\d+\|([^|]+)\|([^|\r\n]+)/m.exec(output);
  return match ? { repositoryName: match[1]!, server: match[2]! } : null;
}
