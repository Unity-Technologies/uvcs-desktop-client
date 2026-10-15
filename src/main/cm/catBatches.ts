// `cm cat` of many revisions in one command (ARCHITECTURE.md "Server budget"): `cm cat <spec>;<file> <spec>;<file> …`
// saves them all with one process start and one connection, instead of one command each. What `cm` still does per
// revision is up to the specs: a batch of revisions by id (`revid:`) is looked up together, while items at a point
// (`itemid:N#cs:M`) are looked up one by one inside the command. Shared by every reader that downloads revisions asked
// together: a merge's conflicting files (`RevisionCat`), a model's textures (`RevisionDownloads`).

import { commandLineLength, MAX_COMMAND_LINE } from './commandLineLimit';

/** One revision for `cm cat` to write to a file. */
export interface CatRead {
  /** What `cm cat` reads: `revid:45@game@local`, `itemid:27#cs:12@game@local`. */
  spec: string;
  /**
   * The repository the spec reads in, as it names it (`game@local`); null where it can't be told, and then the
   * revision goes alone. A batch holds one repository's revisions: `cm cat` takes each repository's apart.
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
 * The reads in batches of one `cm cat` each, in their order within each group (`catGroupOf`): one repository and one
 * form of spec each, within `maxBytes` (one revision past it goes alone) and a command line Windows can start
 * (`MAX_COMMAND_LINE`). A read with no group goes alone, as `--file=`.
 */
export function catBatchesOf<T>(reads: readonly T[], catReadOf: (read: T) => CatRead, limits: CatBatchLimits = {}): T[][] {
  const batches: T[][] = [];
  const byGroup = new Map<string, T[]>();
  for (const read of reads) {
    const group = catGroupOf(catReadOf(read));
    if (group === null) batches.push([read]);
    else if (byGroup.has(group)) byGroup.get(group)!.push(read);
    else byGroup.set(group, [read]);
  }
  for (const grouped of byGroup.values()) {
    let batch = new CatBatch<T>(catReadOf, limits);
    for (const read of grouped) {
      if (!batch.fits(read)) {
        batches.push(batch.reads);
        batch = new CatBatch<T>(catReadOf, limits);
      }
      batch.add(read);
    }
    batches.push(batch.reads);
  }
  return batches;
}

/**
 * The next batch of the reads: the first read not in `after`'s group (so a group read last makes way for another, a
 * small read of another view never waiting behind a long queue), and the reads of its group after it that fit with it.
 */
export function nextCatBatch<T>(reads: readonly T[], catReadOf: (read: T) => CatRead, after: string | null = null, limits: CatBatchLimits = {}): { batch: T[]; group: string | null } {
  const first = reads.find((read) => after === null || catGroupOf(catReadOf(read)) !== after) ?? reads[0];
  if (first === undefined) return { batch: [], group: null };
  const group = catGroupOf(catReadOf(first));
  if (group === null) return { batch: [first], group };
  const batch = new CatBatch<T>(catReadOf, limits);
  batch.add(first);
  for (const read of reads) {
    if (read === first || catGroupOf(catReadOf(read)) !== group) continue;
    if (!batch.fits(read)) break;
    batch.add(read);
  }
  return { batch: batch.reads, group };
}

/**
 * What a read is batched with: its repository (`cm cat` takes each repository's apart) and its spec's form (only
 * revisions by id are looked up together); null for one that goes alone: its repository unknown, or its file's path
 * holding `;`, which can't be named in `<spec>;<file>`.
 */
export function catGroupOf({ spec, repository, target }: CatRead): string | null {
  if (repository === null || target.includes(';')) return null;
  return `${spec.startsWith('revid:') ? 'revid' : 'other'}\0${repository}`;
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

/** A batch being filled: the command line grows by each revision's argument, measured one at a time. */
class CatBatch<T> {
  readonly reads: T[] = [];
  private bytes = 0;
  private length = commandLineLength(['cat']);

  constructor(
    private readonly catReadOf: (read: T) => CatRead,
    private readonly limits: CatBatchLimits,
  ) {}

  fits(read: T): boolean {
    if (this.reads.length === 0) return true;
    const catRead = this.catReadOf(read);
    return this.bytes + this.sizeOf(catRead) <= (this.limits.maxBytes ?? Infinity) && this.length + commandLineLength([batchArg(catRead)]) <= MAX_COMMAND_LINE;
  }

  add(read: T): void {
    const catRead = this.catReadOf(read);
    this.reads.push(read);
    this.bytes += this.sizeOf(catRead);
    this.length += commandLineLength([batchArg(catRead)]);
  }

  private sizeOf({ size }: CatRead): number {
    return size >= 0 ? size : (this.limits.unknownSize ?? 0);
  }
}

function batchArg({ spec, target }: CatRead): string {
  return `${spec};${target}`;
}
