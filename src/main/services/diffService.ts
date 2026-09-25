import type { DiffApi } from '@shared/api/diff';
import type { DiffTarget } from '@shared/domain/diff';
import { DIFF_FORMAT, parseDiffEntries } from '../cm/diffEntries';
import type { ServiceContext } from './ServiceContext';

export function createDiffService({ cm }: ServiceContext): DiffApi {
  return {
    async entries(workspacePath, target) {
      const output = await cm.query(['diff', ...targetSpecs(target), '--repositorypaths', `--format=${DIFF_FORMAT}`], {
        cwd: workspacePath,
      });
      return parseDiffEntries(output);
    },
  };
}

function targetSpecs(target: DiffTarget): string[] {
  switch (target.kind) {
    case 'changeset':
      return [`cs:${target.changesetId}`];
    case 'range':
      return [target.fromSpec, target.toSpec];
    case 'branch':
      return [`br:${target.branch}`];
    case 'shelve':
      return [`sh:${target.shelveId}`];
  }
}
