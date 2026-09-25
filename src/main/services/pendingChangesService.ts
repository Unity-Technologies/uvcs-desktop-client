import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PendingChangesApi } from '@shared/api/pendingChanges';
import type {
  CheckinRequest,
  CheckinResult,
  FilterRuleList,
  PendingChangesFilter,
  PendingChangesSnapshot,
} from '@shared/domain/pendingChanges';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { withTempFile } from '../files/tempFile';
import { toAbsolutePath } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

const FILTER_RULE_FILES: Record<FilterRuleList, string> = {
  ignore: 'ignore.conf',
  cloaked: 'cloaked.conf',
  hidden: 'hidden_changes.conf',
};

const CREATED_CHANGESET_LINE = /^CHANGESET cs:(\d+)@br:([^@]+)@/m;
const CREATED_SHELVE = /sh:(\d+)/;

export function createPendingChangesService({ cm, operations }: ServiceContext): PendingChangesApi {
  async function list(workspacePath: string, filter: PendingChangesFilter): Promise<PendingChangesSnapshot> {
    const xml = await cm.query(['status', '--xml', '--iscochanged', ...searchTypes(filter)], { cwd: workspacePath });
    return parsePendingChanges(xml);
  }

  function checkin(workspacePath: string, request: CheckinRequest, operationId: string): Promise<CheckinResult> {
    return operations.run(operationId, ({ signal, reportProgress }) =>
      withTempFile(request.comment, async (commentsFile) => {
        const output = await cm.execute(
          [
            'checkin',
            ...absolutePaths(workspacePath, request.paths),
            '--all',
            '--private',
            `-commentsfile=${commentsFile}`,
            '--machinereadable',
          ],
          { cwd: workspacePath, signal, onOutputLine: reportProgress },
        );
        const created = CREATED_CHANGESET_LINE.exec(output);
        if (!created) throw new Error('The checkin finished but no changeset was reported.');
        return { changesetId: Number(created[1]), branch: created[2] };
      }),
    );
  }

  async function undo(workspacePath: string, paths: string[]): Promise<void> {
    await cm.query(['undo', ...absolutePaths(workspacePath, paths)], { cwd: workspacePath });
  }

  async function undoUnchanged(workspacePath: string): Promise<void> {
    await cm.query(['undo', '--unchanged', '-r', workspacePath], { cwd: workspacePath });
  }

  async function add(workspacePath: string, paths: string[]): Promise<void> {
    await cm.query(['add', '--coparent', ...absolutePaths(workspacePath, paths)], { cwd: workspacePath });
  }

  async function remove(workspacePath: string, paths: string[]): Promise<void> {
    await cm.query(['remove', ...absolutePaths(workspacePath, paths)], { cwd: workspacePath });
  }

  async function checkout(workspacePath: string, paths: string[]): Promise<void> {
    await cm.query(['checkout', ...absolutePaths(workspacePath, paths)], { cwd: workspacePath });
  }

  async function addFilterRule(workspacePath: string, list: FilterRuleList, pattern: string): Promise<void> {
    const rulesFile = join(workspacePath, FILTER_RULE_FILES[list]);
    const current = await readFile(rulesFile, 'utf8').catch(() => '');
    const separator = current === '' || current.endsWith('\n') ? '' : '\n';
    await appendFile(rulesFile, `${separator}${pattern}\n`, 'utf8');
  }

  function shelve(workspacePath: string, paths: string[], comment: string): Promise<number> {
    return withTempFile(comment, async (commentsFile) => {
      const output = await cm.execute(
        [
          'shelveset',
          'create',
          ...absolutePaths(workspacePath, paths),
          '--all',
          `-commentsfile=${commentsFile}`,
          '--summaryformat',
        ],
        { cwd: workspacePath },
      );
      const created = CREATED_SHELVE.exec(output);
      if (!created) throw new Error('The shelve finished but no shelve id was reported.');
      return Number(created[1]);
    });
  }

  return { list, checkin, undo, undoUnchanged, add, remove, checkout, addFilterRule, shelve };
}

function searchTypes(filter: PendingChangesFilter): string[] {
  return [
    '--controlledchanged',
    '--changed',
    '--localdeleted',
    ...(filter.detectLocalMoves ? ['--localmoved', `--percentofsimilarity=${filter.moveSimilarityPercent}`] : []),
    ...(filter.showPrivate ? ['--private'] : []),
    ...(filter.showIgnored ? ['--ignored'] : []),
    ...(filter.showCloaked ? ['--cloaked'] : []),
    ...(filter.showHiddenChanged ? ['--hiddenchanged'] : []),
  ];
}

function absolutePaths(workspacePath: string, relativePaths: string[]): string[] {
  return relativePaths.map((path) => toAbsolutePath(workspacePath, path));
}
