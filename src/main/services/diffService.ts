import type { DiffApi } from '@shared/api/diff';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { CmClient } from '../cm/CmClient';
import { DIFF_FORMAT, parseDiffEntries } from '../cm/diffEntries';
import type { ServiceContext } from './ServiceContext';

export function createDiffService({ cm }: ServiceContext): DiffApi {
  return {
    entries(workspacePath, target) {
      if (target.kind === 'branch') return branchEntries(cm, workspacePath, `br:${target.branch}`);
      return diffEntries(cm, workspacePath, targetSpecs(target));
    },
  };
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
