import { existsSync } from 'node:fs';
import { repositorySpec } from '@shared/domain/specs';
import { concurrencyLimit } from '@shared/concurrencyLimit';
import type { CmClient } from './CmClient';
import { machineReadableHeaderArgs, parseMachineReadableHeader } from './workspaceStatus';

const CONCURRENT_LOOKUPS = 2;
/** A workspace whose server asks for credentials makes `cm` spin forever; kill it hard. */
const LOOKUP_TIMEOUT_MS = 4000;

/** `STATUS|<changeset>|<repository>|<server>` from `cm status --header --machinereadable`. */
export function repositoryInStatusHeader(output: string): string | null {
  const header = parseMachineReadableHeader(output);
  return header && repositorySpec(header.repositoryName, header.server);
}

/** A workspace's repository (`name@server`), null when it can't be told quickly. */
export type WorkspaceRepositoryLookup = (workspacePath: string, signal: AbortSignal) => Promise<string | null>;

/**
 * Looks workspaces' repositories up two at a time across the session (the home screen asks about each recent
 * workspace on its own), giving up (and killing `cm`) on the ones that don't answer quickly. Aborting a lookup's
 * `signal` kills it, or skips it while it waits its turn.
 */
export function workspaceRepositoryLookup(cm: CmClient): WorkspaceRepositoryLookup {
  const inTurn = concurrencyLimit(CONCURRENT_LOOKUPS);
  return (workspacePath, signal) => inTurn(async () => (signal.aborted ? null : repositoryOf(cm, workspacePath, signal)));
}

async function repositoryOf(cm: CmClient, workspacePath: string, signal: AbortSignal): Promise<string | null> {
  if (!existsSync(workspacePath)) return null;
  try {
    const output = await cm.execute(machineReadableHeaderArgs(workspacePath), {
      signal: AbortSignal.any([signal, AbortSignal.timeout(LOOKUP_TIMEOUT_MS)]),
      killSignal: 'SIGKILL',
    });
    return repositoryInStatusHeader(output);
  } catch {
    return null;
  }
}
