import { existsSync } from 'node:fs';
import type { CmClient } from './CmClient';

/** Only a handful of workspaces (the recent ones) are ever looked up; never the whole list. */
export const MAX_LOOKUPS = 10;
const CONCURRENT_LOOKUPS = 2;
/** A workspace whose server asks for credentials makes `cm` spin forever; kill it hard. */
const LOOKUP_TIMEOUT_MS = 4000;

/** `STATUS|<changeset>|<repository>|<server>` from `cm status --header --machinereadable`. */
export function parseStatusHeader(output: string): string | null {
  const match = /^STATUS\|-?\d+\|([^|]+)\|([^|\r\n]+)/m.exec(output);
  return match ? `${match[1]}@${match[2]}` : null;
}

/**
 * Finds the repository of up to `MAX_LOOKUPS` workspaces, two at a time,
 * giving up (and killing `cm`) on the ones that don't answer quickly.
 * Aborting `signal` kills the running lookups and skips the rest.
 */
export async function resolveWorkspaceRepositories(
  cm: CmClient,
  workspacePaths: string[],
  signal: AbortSignal,
): Promise<Record<string, string | null>> {
  const repositories: Record<string, string | null> = {};
  const pending = [...new Set(workspacePaths)].slice(0, MAX_LOOKUPS);

  const worker = async (): Promise<void> => {
    for (let path = pending.shift(); path !== undefined && !signal.aborted; path = pending.shift()) {
      repositories[path] = await repositoryOf(cm, path, signal);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENT_LOOKUPS }, worker));
  return repositories;
}

async function repositoryOf(cm: CmClient, workspacePath: string, signal: AbortSignal): Promise<string | null> {
  if (!existsSync(workspacePath)) return null;
  try {
    const output = await cm.execute(['status', '--header', '--machinereadable', '--fieldseparator=|', workspacePath], {
      signal: AbortSignal.any([signal, AbortSignal.timeout(LOOKUP_TIMEOUT_MS)]),
      killSignal: 'SIGKILL',
    });
    return parseStatusHeader(output);
  } catch {
    return null;
  }
}
