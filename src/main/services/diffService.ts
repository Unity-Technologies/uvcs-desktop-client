import type { DiffApi } from '@shared/api/diff';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { XlinkTarget } from '@shared/domain/explorer';
import type { CmClient } from '../cm/CmClient';
import { DIFF_FORMAT, parseDiffEntries } from '../cm/diffEntries';
import { isNotInTreeError } from '../cm/missingItem';
import { parentPointOf, readsSide, xlinkAfterPoint, xlinkBeforePoint, xlinkIn, xlinkListArgs, type XlinkSidePoint } from '../cm/xlinkSides';
import type { ServiceContext } from './ServiceContext';

export function createDiffService({ cm, handedOverDiffs }: ServiceContext): DiffApi {
  return {
    async entries(workspacePath, target) {
      const handedOver = handedOverDiffs.take(workspacePath, target);
      if (handedOver) return handedOver;
      if (target.kind === 'branch') return branchEntries(cm, workspacePath, `br:${target.branch}`);
      return diffEntries(cm, workspacePath, targetSpecs(target));
    },

    async xlinkSides(workspacePath, target, { path, oldPath, status }) {
      const before = xlinkBeforePoint(target);
      const after = xlinkAfterPoint(target);
      const [beforeTarget, afterTarget] = await Promise.all([
        readsSide(before, 'before', status) ? xlinkAt(cm, workspacePath, before, oldPath ?? path) : null,
        readsSide(after, 'after', status) ? xlinkAt(cm, workspacePath, after, path) : null,
      ]);
      return { before: beforeTarget, after: afterTarget };
    },
  };
}

/**
 * Where the xlink at `path` points at one side: one quick `cm ls` of its folder, after a `cm find` naming the side's
 * changeset when it is a parent. A folder that isn't in that tree (added after it) has no xlink there.
 */
async function xlinkAt(cm: CmClient, workspacePath: string, side: NonNullable<XlinkSidePoint>, path: string): Promise<XlinkTarget | null> {
  const point = side.kind === 'point' ? side.spec : parentPointOf(await cm.query(side.findArgs, { cwd: workspacePath }));
  if (point === null) return null;
  try {
    return xlinkIn(await cm.query(xlinkListArgs(path, point), { cwd: workspacePath }), path);
  } catch (error) {
    if (isNotInTreeError(error)) return null;
    throw error;
  }
}

/**
 * What a branch brings to its parent, as a pull request shows it. `cm diff --integration` diffs from the branch's
 * common ancestor with its parent, so what the branch merged from its parent (or a rebase) doesn't show. A branch
 * already merged into its parent has nothing pending, and neither has `/main`, which has no parent (cm 11.0.16): `cm`
 * diffs the head against itself, an empty and cheap answer, and only then is the whole branch asked for, so its diff
 * still shows what it changed.
 */
async function branchEntries(cm: CmClient, workspacePath: string, branchSpec: string): Promise<DiffEntry[]> {
  const pending = await diffEntries(cm, workspacePath, [branchSpec, '--integration']);
  if (pending.length > 0) return pending;
  return diffEntries(cm, workspacePath, [branchSpec]);
}

async function diffEntries(cm: CmClient, workspacePath: string, specs: string[]): Promise<DiffEntry[]> {
  const output = await cm.query(['diff', ...specs, '--repositorypaths', `--format=${DIFF_FORMAT}`], { cwd: workspacePath });
  return parseDiffEntries(output);
}

function targetSpecs(target: Exclude<DiffTarget, { kind: 'branch' }>): string[] {
  switch (target.kind) {
    case 'changeset':
      return [`cs:${target.changesetId}`];
    case 'range':
      return [target.fromSpec, target.toSpec];
    case 'shelve':
      return [`sh:${target.shelveId}`];
  }
}
