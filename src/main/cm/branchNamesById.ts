import type { CmClient } from './CmClient';
import { findRecords, toBranch } from './findObjects';

/** `cm find` has no `in (...)`, so ids are looked up in small `or` batches that run in parallel. */
const IDS_PER_QUERY = 50;

/**
 * Resolves branch object ids (as `cm find review` reports its targets) to branch names.
 * Ids that don't resolve (e.g. deleted branches) are simply missing from the result.
 */
export async function branchNamesById(cm: CmClient, workspacePath: string, ids: number[]): Promise<Map<number, string>> {
  const batches = chunk([...new Set(ids)], IDS_PER_QUERY);
  const results = await Promise.all(
    batches.map((batch) => cm.query(['find', 'branch', branchIdCondition(batch), '--xml', '--nototal'], { cwd: workspacePath })),
  );
  return new Map(results.flatMap((xml) => findRecords(xml, 'BRANCH').map(toBranch)).map((branch) => [branch.id, branch.name]));
}

export function branchIdCondition(ids: number[]): string {
  return `where ${ids.map((id) => `id = ${id}`).join(' or ')}`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}
