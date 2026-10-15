import { existsSync } from 'node:fs';
import { repositorySpec } from '@shared/domain/specs';
import { concurrencyLimit } from '@shared/concurrencyLimit';
import type { CmClient } from './CmClient';
import { machineReadableHeaderArgs, parseMachineReadableHeader } from './workspaceStatus';

/** Only a handful of workspaces (the recent ones) are ever looked up; never the whole list. */
export const MAX_LOOKUPS = 10;
const CONCURRENT_LOOKUPS = 2;
/** A workspace whose server asks for credentials makes `cm` spin forever; kill it hard. */
const LOOKUP_TIMEOUT_MS = 4000;

/** `STATUS|<changeset>|<repository>|<server>` from `cm status --header --machinereadable`. */
export function repositoryInStatusHeader(output: string): string | null {
  const header = parseMachineReadableHeader(output);
  return header && repositorySpec(header.repositoryName, header.server);
}

/** Finds the repository of up to `MAX_LOOKUPS` workspaces (`lookUp`, read by `workspaceRepositoryLookups`). */
export type WorkspaceRepositoryLookups = (workspacePaths: string[], signal: AbortSignal) => Promise<Record<string, string | null>>;

/**
 * Looks workspaces' repositories up two at a time across every call of the session (the home screen asks about each
 * recent workspace on its own), giving up (and killing `cm`) on the ones that don't answer quickly. Aborting a call's
 * `signal` kills its running lookups and skips the rest.
 */
export function workspaceRepositoryLookups(cm: CmClient): WorkspaceRepositoryLookups {
  const inTurn = concurrencyLimit(CONCURRENT_LOOKUPS);
  return async (workspacePaths, signal) => {
    const repositories: Record<string, string | null> = {};
    const paths = [...new Set(workspacePaths)].slice(0, MAX_LOOKUPS);
    await Promise.all(
      paths.map((path) =>
        inTurn(async () => {
          if (!signal.aborted) repositories[path] = await repositoryOf(cm, path, signal);
        }),
      ),
    );
    return repositories;
  };
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
