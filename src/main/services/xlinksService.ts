import type { XlinksApi } from '@shared/api/xlinks';
import type { NewXlink, XlinkEdit, XlinkPoint } from '@shared/domain/xlinks';
import { layoutReader } from '../cm/formatRecords';
import { FOUND_LABELS } from '../cm/foundObjects';
import { subfoldersIn } from '../cm/repositoryFolders';
import { readTreeItem } from '../cm/treeItems';
import {
  addXlinkRulesArgs,
  createXlinkArgs,
  deleteXlinkRulesArgs,
  editXlinkPointArgs,
  labelChangesetArgs,
  repositoryFolderArgs,
  showXlinkArgs,
  xlinkPointSpec,
  xlinkTreeSpec,
} from '../cm/xlinkArgs';
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

  async function treePoint(workspacePath: string, repository: string, point: XlinkPoint) {
    const spec = xlinkTreeSpec(point, repository);
    if (spec) return spec;
    const label = point.kind === 'label' ? point.label.trim() : '';
    const labels = await cm.queryRecords(labelChangesetArgs(label, repository), layoutReader(FOUND_LABELS), inWorkspace(workspacePath));
    const found = labels.find((each) => each.name === label);
    if (!found) throw new Error(`There is no label ${label} in ${repository}.`);
    return xlinkPointSpec({ kind: 'changeset', changeset: found.changeset }, repository);
  }

  async function folders(workspacePath: string, treeSpec: string, folder: string) {
    return subfoldersIn(await cm.queryRecords(repositoryFolderArgs(folder, treeSpec), readTreeItem, inWorkspace(workspacePath)));
  }

  // Rules are dropped before any is added: a rule that changes keeps its branch, and `cm` refuses a second rule for it.
  // When adding fails (a branch that doesn't exist), the dropped rules go back: the xlink keeps the rules the dialog
  // still shows, and saving again drops them again. Pointing it again where it already points changes nothing.
  async function edit(workspacePath: string, { path, repository, point, removedRules, addedRules }: XlinkEdit) {
    const absolutePath = toAbsolutePath(workspacePath, path);
    const run = (args: string[]) => cm.query(args, inWorkspace(workspacePath));
    if (point) await run(editXlinkPointArgs(absolutePath, point, repository));
    if (removedRules.length > 0) await run(deleteXlinkRulesArgs(absolutePath, removedRules));
    if (addedRules.length === 0) return;
    try {
      await run(addXlinkRulesArgs(absolutePath, addedRules));
    } catch (error) {
      if (removedRules.length > 0) await run(addXlinkRulesArgs(absolutePath, removedRules));
      throw error;
    }
  }

  return { rules, create, treePoint, folders, edit };
}
