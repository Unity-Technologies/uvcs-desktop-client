import type { SelectorKind, WorkspaceSelector } from '@shared/domain/workspace';
import type { CmClient } from './CmClient';
import { equalsCondition, findQueryArgs } from './findQuery';
import { FOUND_BRANCHES, FOUND_CHANGESETS, FOUND_LABELS, FOUND_SHELVES, type FoundObjects } from './foundObjects';
import { layoutReader } from './formatRecords';

interface WorkingObjectQuery {
  /** Branches and labels have a name, which tells the object among those found; changesets and shelves a number. */
  found: FoundObjects<{ name?: string; comment: string }>;
  condition: (name: string) => string;
}

const QUERIES: Record<SelectorKind, WorkingObjectQuery> = {
  // `name` is a branch's last segment (`task` for `/main/task`), so the full name is checked on the results.
  branch: { found: FOUND_BRANCHES, condition: (name) => equalsCondition('name', name.split('/').pop() ?? '') },
  label: { found: FOUND_LABELS, condition: (name) => equalsCondition('name', name) },
  changeset: { found: FOUND_CHANGESETS, condition: (id) => `changesetid = ${Number(id)}` },
  shelve: { found: FOUND_SHELVES, condition: (id) => `shelveid = ${Number(id)}` },
};

/** The `cm find` arguments that read the object a workspace is loaded from. */
export function workingObjectFindArgs(selector: WorkspaceSelector): string[] {
  const { found, condition } = QUERIES[selector.kind];
  return findQueryArgs(found, `where ${condition(selector.name)}`);
}

/** The comment of the object a workspace is loaded from; empty when it has none or wasn't found (e.g. a hidden branch). */
export async function readWorkingObjectComment(cm: CmClient, workspacePath: string, selector: WorkspaceSelector): Promise<string> {
  const objects = await cm.queryRecords(workingObjectFindArgs(selector), layoutReader(QUERIES[selector.kind].found), { cwd: workspacePath });
  const isNamed = selector.kind === 'branch' || selector.kind === 'label';
  const object = isNamed ? objects.find((candidate) => candidate.name === selector.name) : objects[0];
  return object?.comment ?? '';
}
