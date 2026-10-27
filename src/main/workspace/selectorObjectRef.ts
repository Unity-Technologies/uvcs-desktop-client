import { shortBranchName } from '@shared/domain/specs';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import type { CmClient } from '../cm/CmClient';
import { equalsCondition, findQueryArgs } from '../cm/findQuery';
import { FOUND_BRANCHES, FOUND_LABELS } from '../cm/foundObjects';
import { layoutReader } from '../cm/formatRecords';

/**
 * The reference the official client puts in automatic shelve comments for a selector: `br:<branch id>`,
 * `cs:<changeset number>` or `lb:<label id>`. Shelves have none: changes can't be left on a shelve.
 */
export async function selectorObjectRef(cm: CmClient, workspacePath: string, selector: WorkspaceSelector): Promise<string | null> {
  switch (selector.kind) {
    case 'changeset':
      return `cs:${selector.name}`;
    case 'branch': {
      // `cm find` matches branches by their last name part only.
      const where = `where ${equalsCondition('name', shortBranchName(selector.name))}`;
      const branches = await cm.queryRecords(findQueryArgs(FOUND_BRANCHES, where), layoutReader(FOUND_BRANCHES), { cwd: workspacePath });
      const branch = branches.find((candidate) => candidate.name === selector.name);
      return branch ? `br:${branch.id}` : null;
    }
    case 'label': {
      const where = `where ${equalsCondition('name', selector.name)}`;
      const labels = await cm.queryRecords(findQueryArgs(FOUND_LABELS, where), layoutReader(FOUND_LABELS), { cwd: workspacePath });
      const label = labels.find((candidate) => candidate.name === selector.name);
      return label ? `lb:${label.id}` : null;
    }
    case 'shelve':
      return null;
  }
}
