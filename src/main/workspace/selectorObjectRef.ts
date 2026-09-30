import { shortBranchName } from '@shared/domain/specs';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import type { CmClient } from '../cm/CmClient';
import { findRecords, toBranch, toLabel } from '../cm/findObjects';
import { equalsCondition } from '../cm/findQuery';

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
      const xml = await cm.query(['find', 'branch', `where ${equalsCondition('name', shortBranchName(selector.name))}`, '--xml', '--nototal'], {
        cwd: workspacePath,
      });
      const branch = findRecords(xml, 'BRANCH').map(toBranch).find((candidate) => candidate.name === selector.name);
      return branch ? `br:${branch.id}` : null;
    }
    case 'label': {
      const xml = await cm.query(['find', 'label', `where ${equalsCondition('name', selector.name)}`, '--xml', '--nototal'], { cwd: workspacePath });
      const label = findRecords(xml, 'LABEL').map(toLabel).find((candidate) => candidate.name === selector.name);
      return label ? `lb:${label.id}` : null;
    }
    case 'shelve':
      return null;
  }
}
