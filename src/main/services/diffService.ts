import type { DiffApi } from '@shared/api/diff';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { XlinkTarget } from '@shared/domain/explorer';
import type { CmClient } from '../cm/CmClient';
import { cmPlace, type CmPlace } from '../cm/cmPlace';
import { DIFF_FORMAT, parseDiffEntries } from '../cm/diffEntries';
import { isNotInTreeError } from '../cm/missingItem';
import { parentPointOf, readsSide, xlinkAfterPoint, xlinkBeforePoint, xlinkIn, xlinkListArgs, type XlinkSidePoint } from '../cm/xlinkSides';
import type { ServiceContext } from './ServiceContext';

export function createDiffService({ cm, handedOverDiffs }: ServiceContext): DiffApi {
  return {
    async entries(place, target) {
      const handedOver = handedOverDiffs.take(place, target);
      if (handedOver) return handedOver;
      const at = cmPlace(place);
      if (target.kind === 'branch') return branchEntries(cm, at, at.spec(`br:${target.branch}`));
      return diffEntries(cm, at, targetSpecs(target).map(at.spec));
    },

    async xlinkSides(place, target, { path, oldPath, status }) {
      const at = cmPlace(place);
      const before = xlinkBeforePoint(target, at.repository);
      const after = xlinkAfterPoint(target);
      const [beforeTarget, afterTarget] = await Promise.all([
        readsSide(before, 'before', status) ? xlinkAt(cm, at, before, oldPath ?? path) : null,
        readsSide(after, 'after', status) ? xlinkAt(cm, at, after, path) : null,
      ]);
      return { before: beforeTarget, after: afterTarget };
    },
  };
}

/**
 * Where the xlink at `path` points at one side: one quick `cm ls` of its folder, after a `cm find` naming the side's
 * changeset when it is a parent. A folder that isn't in that tree (added after it) has no xlink there.
 */
async function xlinkAt(cm: CmClient, at: CmPlace, side: NonNullable<XlinkSidePoint>, path: string): Promise<XlinkTarget | null> {
  const point = side.kind === 'point' ? side.spec : parentPointOf(await cm.query(side.findArgs, at.options));
  if (point === null) return null;
  try {
    return xlinkIn(await cm.query(xlinkListArgs(path, at.spec(point)), at.options), path);
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
async function branchEntries(cm: CmClient, at: CmPlace, branchSpec: string): Promise<DiffEntry[]> {
  const pending = await diffEntries(cm, at, [branchSpec, '--integration']);
  if (pending.length > 0) return pending;
  return diffEntries(cm, at, [branchSpec]);
}

/** `cm diff` of specs that name the place's repository where no workspace tells `cm` which. */
async function diffEntries(cm: CmClient, at: CmPlace, specs: string[]): Promise<DiffEntry[]> {
  const output = await cm.query(['diff', ...specs, '--repositorypaths', `--format=${DIFF_FORMAT}`], at.options);
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
