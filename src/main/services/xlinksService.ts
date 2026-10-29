import { join } from 'node:path';
import { app } from 'electron';
import type { XlinksApi } from '@shared/api/xlinks';
import type { CreatedXlink, LoadedXlinkFiles, NewXlink, XlinkEdit, XlinkPoint } from '@shared/domain/xlinks';
import { checkinArgs } from '../cm/checkinArgs';
import { readCheckinOutput } from '../cm/checkinOutput';
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
import { withTempFile } from '../files/tempFile';
import { toAbsolutePath } from '../files/workspacePaths';
import { failureReason } from '../workspace/putShelvedChangesBack';
import { loadXlink, type XlinkLoad } from '../workspace/loadXlink';
import type { ServiceContext, SwitchContext } from './ServiceContext';

const filesOf = (load: XlinkLoad): LoadedXlinkFiles => (load.kind === 'changesWaiting' ? { changesWaitIn: load.shelveId } : {});

/**
 * Xlinks created and edited. Creating one checks it in and loads its files, an operation; every other command is a
 * quick one, as none moves files (`xlinkArgs`).
 */
export function createXlinksService({ cm, operations }: Pick<ServiceContext, 'cm' | 'operations'>, { switchShelves, leftChanges }: SwitchContext): XlinksApi {
  const inWorkspace = (workspacePath: string) => ({ cwd: workspacePath });
  const shelveFlow = { cm, records: switchShelves, leftChanges, backupsRoot: join(app.getPath('userData'), 'shelve-backups') };

  async function rules(workspacePath: string, path: string) {
    const output = await cm.query(showXlinkArgs(toAbsolutePath(workspacePath, path)), inWorkspace(workspacePath));
    return parseXlinkRules(output);
  }

  // Once `cm xlink` made it, the xlink exists whatever comes next: a later failure is what it resolves to, not an error,
  // so the dialog doesn't offer to create it again.
  function create(workspacePath: string, xlink: NewXlink, comment: string, operationId: string): Promise<CreatedXlink> {
    return operations.run(operationId, async (context) => {
      const absolutePath = toAbsolutePath(workspacePath, xlink.path);
      await cm.query(createXlinkArgs(absolutePath, xlink), inWorkspace(workspacePath));

      context.reportProgress('Checking in the xlink');
      let changesetId: number;
      try {
        changesetId = await checkInAlone(workspacePath, absolutePath, comment);
      } catch (error) {
        return { kind: 'notCheckedIn', reason: failureReason(error) };
      }

      context.reportProgress('Loading its files');
      try {
        return { kind: 'loaded', changesetId, ...filesOf(await loadXlink(shelveFlow, workspacePath, xlink.path, context)) };
      } catch (error) {
        return { kind: 'notLoaded', changesetId, reason: failureReason(error) };
      }
    });
  }

  function load(workspacePath: string, path: string, operationId: string): Promise<LoadedXlinkFiles> {
    return operations.run(operationId, async (context) => filesOf(await loadXlink(shelveFlow, workspacePath, path, context)));
  }

  /** Checks in the xlink and nothing else: the folder holding it, and the added folders above, go in with it (`checkinArgs`). */
  function checkInAlone(workspacePath: string, absolutePath: string, comment: string): Promise<number> {
    return withTempFile(comment, async (commentsFile) => {
      const checkin = readCheckinOutput(await cm.execute(checkinArgs([absolutePath], commentsFile, false), inWorkspace(workspacePath)));
      if (checkin.kind === 'noChanges') throw new Error('Nothing was checked in');
      return checkin.changesetId;
    });
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

  return { rules, create, load, treePoint, folders, edit };
}
