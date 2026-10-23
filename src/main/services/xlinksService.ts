import type { XlinksApi } from '@shared/api/xlinks';
import type { NewXlink, XlinkEdit } from '@shared/domain/xlinks';
import { addXlinkRulesArgs, createXlinkArgs, deleteXlinkRulesArgs, editXlinkPointArgs, showXlinkArgs } from '../cm/xlinkArgs';
import { parseXlinkRules } from '../cm/xlinkShow';
import { toAbsolutePath } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

/** Xlinks created and edited: every command a quick one, as none moves files (`xlinkArgs`). */
export function createXlinksService({ cm }: Pick<ServiceContext, 'cm'>): XlinksApi {
  const inWorkspace = (workspacePath: string) => ({ cwd: workspacePath });

  async function rules(workspacePath: string, path: string) {
    const output = await cm.query(showXlinkArgs(toAbsolutePath(workspacePath, path)), inWorkspace(workspacePath));
    return parseXlinkRules(output);
  }

  async function create(workspacePath: string, xlink: NewXlink) {
    await cm.query(createXlinkArgs(toAbsolutePath(workspacePath, xlink.path), xlink), inWorkspace(workspacePath));
  }

  // Rules are dropped before any is added: a rule that changes keeps its branch, and `cm` refuses a second rule for it.
  async function edit(workspacePath: string, { path, repository, point, removedRules, addedRules }: XlinkEdit) {
    const absolutePath = toAbsolutePath(workspacePath, path);
    const run = (args: string[]) => cm.query(args, inWorkspace(workspacePath));
    if (point) await run(editXlinkPointArgs(absolutePath, point, repository));
    if (removedRules.length > 0) await run(deleteXlinkRulesArgs(absolutePath, removedRules));
    if (addedRules.length > 0) await run(addXlinkRulesArgs(absolutePath, addedRules));
  }

  return { rules, create, edit };
}
