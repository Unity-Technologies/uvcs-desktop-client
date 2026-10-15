// `cm cat` of many revisions in one command (ARCHITECTURE.md "Server budget"): `cm cat <spec>;<file> <spec>;<file> …`
// downloads them in one batch, one round trip instead of one per revision. Shared by every reader that downloads
// revisions asked together: a merge's conflicting files (`RevisionCat`), a model's textures (`RevisionDownloads`).

import { commandLineLength, MAX_COMMAND_LINE } from './commandLineLimit';

/** One revision for `cm cat` to write to a file. */
export interface CatRead {
  /** What `cm cat` reads: `revid:45@game@local`, `itemid:27#cs:12@game@local`. */
  spec: string;
  /**
   * The repository the spec reads in, as it names it (`game@local`); null where it can't be told, and then the
   * revision goes alone. `cm cat` resolves each repository's revisions on its own, and mixing two in one command
   * misreads which revision was found: a batch holds one repository's.
   */
  repository: string | null;
  /** The file it is written to: absolute. */
  target: string;
  /** In bytes, -1 where not known. */
  size: number;
}

export interface CatBatchLimits {
  /** The most bytes one batch downloads, by the sizes known: a smaller batch shows its first files sooner. */
  maxBytes?: number;
  /** What a revision of unknown size counts as against `maxBytes`. */
  unknownSize?: number;
}

/**
 * The reads in batches of one `cm cat` each, in their order within each repository: one repository each, within
 * `maxBytes` (one revision past it goes alone) and a command line Windows can start (`MAX_COMMAND_LINE`). A revision
 * whose repository can't be told, or whose file's path holds `;` (it can't be named in `<spec>;<file>`), goes alone, as
 * `--file=`.
 */
export function catBatchesOf<T>(reads: readonly T[], catReadOf: (read: T) => CatRead, { maxBytes = Infinity, unknownSize = 0 }: CatBatchLimits = {}): T[][] {
  const batches: T[][] = [];
  const byRepository = new Map<string, T[]>();
  for (const read of reads) {
    const { repository, target } = catReadOf(read);
    if (repository === null || target.includes(';')) {
      batches.push([read]);
      continue;
    }
    const sameRepository = byRepository.get(repository);
    if (sameRepository) sameRepository.push(read);
    else byRepository.set(repository, [read]);
  }
  // The command line grows by each revision's argument: measured one at a time, not the whole batch again for each.
  const catLength = commandLineLength(['cat']);
  for (const sameRepository of byRepository.values()) {
    let batch: T[] = [];
    let bytes = 0;
    let length = catLength;
    for (const read of sameRepository) {
      const catRead = catReadOf(read);
      const size = catRead.size >= 0 ? catRead.size : unknownSize;
      const argLength = commandLineLength([batchArg(catRead)]);
      if (batch.length > 0 && (bytes + size > maxBytes || length + argLength > MAX_COMMAND_LINE)) {
        batches.push(batch);
        batch = [];
        bytes = 0;
        length = catLength;
      }
      batch.push(read);
      bytes += size;
      length += argLength;
    }
    if (batch.length > 0) batches.push(batch);
  }
  return batches;
}

/**
 * `cm cat` of a batch: one revision as `cm cat <spec> --file=<file>` (the command a lone read always ran), several as
 * `cm cat <spec>;<file> <spec>;<file> …`, each written to its file.
 */
export function catArgs(batch: readonly CatRead[]): string[] {
  const [only] = batch;
  if (only && batch.length === 1) return ['cat', only.spec, `--file=${only.target}`];
  return ['cat', ...batch.map(batchArg)];
}

function batchArg({ spec, target }: CatRead): string {
  return `${spec};${target}`;
}
