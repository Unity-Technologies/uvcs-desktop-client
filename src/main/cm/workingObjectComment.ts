import type { SelectorKind, WorkspaceSelector } from '@shared/domain/workspace';
import type { CmClient } from './CmClient';
import { escapeQueryValue } from './findQuery';
import { findRecords } from './findObjects';
import { text } from './parseXml';

interface WorkingObjectQuery {
  object: string;
  /** The record element of `cm find <object> --xml`. */
  element: string;
  condition: (name: string) => string;
}

const QUERIES: Record<SelectorKind, WorkingObjectQuery> = {
  // `name` is a branch's last segment (`task` for `/main/task`), so the full name is checked on the results.
  branch: {
    object: 'branch',
    element: 'BRANCH',
    condition: (name) => `name = '${escapeQueryValue(name.split('/').pop() ?? '')}'`,
  },
  label: {
    object: 'label',
    element: 'MARKER',
    condition: (name) => `name = '${escapeQueryValue(name)}'`,
  },
  changeset: {
    object: 'changeset',
    element: 'CHANGESET',
    condition: (id) => `changesetid = ${Number(id)}`,
  },
  shelve: {
    object: 'shelve',
    element: 'SHELVE',
    condition: (id) => `shelveid = ${Number(id)}`,
  },
};

/** The `cm find` arguments that read the object a workspace is loaded from. */
export function workingObjectFindArgs(selector: WorkspaceSelector): string[] {
  const query = QUERIES[selector.kind];
  return ['find', query.object, `where ${query.condition(selector.name)}`, '--xml', '--nototal'];
}

/** The comment of that object in the `cm find` output; empty when it has none or wasn't found (e.g. a hidden branch). */
export function workingObjectCommentIn(xml: string, selector: WorkspaceSelector): string {
  const records = findRecords(xml, QUERIES[selector.kind].element);
  const record = selector.kind === 'branch' ? records.find((candidate) => text(candidate.NAME) === selector.name) : records[0];
  return record ? text(record.COMMENT) : '';
}

export async function readWorkingObjectComment(cm: CmClient, workspacePath: string, selector: WorkspaceSelector): Promise<string> {
  return workingObjectCommentIn(await cm.query(workingObjectFindArgs(selector), { cwd: workspacePath }), selector);
}
