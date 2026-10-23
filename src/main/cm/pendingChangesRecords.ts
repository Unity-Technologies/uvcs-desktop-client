import type { ChangeKind, Changelist, PendingChange, PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import { FIELD_SEPARATOR, RECORD_SEPARATOR, type ReadRecord } from './formatRecords';
import { pendingMergeLinks } from './pendingMergeLinks';
import { PrintedWorkspacePaths } from './printedWorkspacePaths';

/**
 * `cm status` printing its records as `--format` does (`recordFormat`): `--machinereadable`, with the separators that
 * split them unambiguously. Its options first, so a command line reads as `status --controlledchanged … --machinereadable …`.
 *
 * `--compact`: without it, `cm status` works out the workspace header even when it prints none, and asks the server for
 * the head of the branch (about 80 ms against Unity Cloud, on every refresh). The header also finds the files left with
 * conflict markers (`CONFLICT_MARKERS`), which no reader uses; the changes and changelists print the same.
 */
export function statusRecordsArgs(...options: string[]): string[] {
  return ['status', ...options, '--machinereadable', '--compact', `--fieldseparator=${FIELD_SEPARATOR}`, `--endlineseparator=${RECORD_SEPARATOR}`];
}

const CHANGE_KINDS: Record<string, ChangeKind> = {
  AD: 'added',
  CO: 'checkedOut',
  CH: 'changed',
  CP: 'copied',
  RP: 'replaced',
  DE: 'deleted',
  LD: 'locallyDeleted',
  MV: 'moved',
  LM: 'locallyMoved',
  PR: 'private',
  IG: 'ignored',
  CL: 'cloaked',
  HC: 'hiddenChanged',
};

const DEFAULT_CHANGELIST = 'Default';
interface ReaderOptions {
  platform?: NodeJS.Platform;
  /** The workspace's root with links resolved (`realpath`), in case `cm` printed that one. */
  resolvedRoot?: string;
  /** Each change read, with its absolute path. */
  onChange?: (change: PendingChange, absolutePath: string) => void;
}

/** What `cm status --machinereadable` prints for a change that comes from no merge. */
const NO_MERGES = 'NO_MERGES';

/** What a change's first field holds: its codes (`CO+CH`), or `--` for none. */
const CODES = /^(--|[A-Z]{2})(\+[A-Z]{2})*$/;

/** A change printed with where it was (moved, locally moved): `<codes> <similarity> <old path> <path> <is folder> <merges>`. */
const MOVED_FIELDS = 6;
/** Any other change: `<codes> <path> <is folder> <merges>`. */
const CHANGE_FIELDS = 4;

/**
 * Reads `cm status` printed as records (`statusRecordsArgs`) as they arrive: a `STATUS` record first, then, with
 * `--changelists`, each changelist (`CHLIST <name> <description>`) followed by its changes; without `--compact`, the
 * files left with conflict markers too (`CONFLICT_MARKERS <path>`). Records, not XML: 100,000 changes print 9 MB where `--xml` printed
 * 60 MB, and 500,000 passed `MAX_OUTPUT_LENGTH` as XML (ARCHITECTURE.md "Parsing `cm` output"). A local read of the
 * workspace, which the server never sees.
 *
 * A change lists every code of the item at once (`CH+MV`), and reads as `cm status --xml` read it before
 * (`listedCodes`). An item printed twice is one change with both kinds, as `--xml` merged it: a deleted file whose
 * path a new file took prints `PR` then `DE`, and stays a deletion; one in several changelists is in the first. Its path comes absolute,
 * made relative to the workspace (`PrintedWorkspacePaths`). Records hold neither the size nor the date nor whether a
 * file is a link: `onChange` gets each change with its absolute path, to read them from the disk (`DiskDetails`).
 */
export class PendingChangesReader {
  private readonly paths: PrintedWorkspacePaths;
  private readonly changelists: Changelist[] = [];
  private readonly mergeInfos = new Set<string>();
  private readonly listed = new Map<string, PendingChange>();
  /** One array of kinds for each combination of codes, shared by the changes that have it: most share a handful. */
  private readonly kindsByCodes = new Map<string, ChangeKind[] | null>();
  private changelist: string | undefined;

  private readonly onChange?: (change: PendingChange, absolutePath: string) => void;

  constructor(workspacePath: string, { platform = process.platform, resolvedRoot, onChange }: ReaderOptions = {}) {
    this.paths = new PrintedWorkspacePaths(workspacePath, platform, resolvedRoot);
    this.onChange = onChange;
  }

  /** Reads one record into its change, if it is one that Changes lists. */
  readonly read: ReadRecord<PendingChange> = (fields) => {
    const [tag = ''] = fields;
    if (tag === 'CHLIST') return this.startChangelist(fields);
    // What the workspace has loaded is read apart (`readWorkspaceStatus`), and Changes lists no conflict markers.
    if (tag === 'STATUS' || tag === 'CONFLICT_MARKERS') return undefined;
    if (fields.length === MOVED_FIELDS || fields.length === CHANGE_FIELDS) return this.changeOf(fields);
    // A change printed with other fields than these (another `cm`) would be lost, and Changes look clean: it fails.
    if (CODES.test(tag)) throw new Error(`cm status printed a change this app can't read: ${fields.join(' ')}`);
    return undefined;
  };

  /** The snapshot of the changes read, with the changelists they are in and the merges they come from. */
  snapshot(changes: PendingChange[]): PendingChangesSnapshot {
    return { changes, changelists: this.changelists, mergeLinks: pendingMergeLinks(this.mergeInfos) };
  }

  private startChangelist([, name = '', description = '']: string[]): undefined {
    this.changelist = name === DEFAULT_CHANGELIST ? undefined : name;
    if (this.changelist !== undefined) this.changelists.push({ name: this.changelist, description });
    return undefined;
  }

  private changeOf(fields: string[]): PendingChange | undefined {
    const moved = fields.length === MOVED_FIELDS;
    const [codes = '', similarity = '', printedOldPath = ''] = moved ? fields : [fields[0]];
    const [printedPath = '', isFolder = '', merges = ''] = fields.slice(moved ? 3 : 1);
    const kinds = this.kindsOf(codes);
    if (!kinds) return undefined;
    const path = this.paths.relative(printedPath);
    const change: PendingChange = { path, kinds, itemType: isFolder === 'True' ? 'directory' : 'file', size: 0, lastModified: '' };
    // A deleted item printed with where it was (`DE+MV`) is only deleted (`listedCodes`): no move to show.
    if (moved && (kinds.includes('moved') || kinds.includes('locallyMoved'))) {
      change.oldPath = this.paths.relative(printedOldPath);
      const percent = similarityPercentOf(similarity);
      if (percent > 0) change.similarityPercent = percent;
    }
    if (merges !== NO_MERGES && merges !== '') {
      change.mergeInfo = merges.split('+').join(', ');
      this.mergeInfos.add(change.mergeInfo);
    }
    if (this.changelist !== undefined) change.changelist = this.changelist;
    const listed = this.listed.get(path);
    if (listed) return void withTheOther(listed, change);
    this.listed.set(path, change);
    this.onChange?.(change, printedPath);
    return change;
  }

  /** The kinds of a combination of codes (`CO+CH`), or null for an item Changes doesn't list. */
  private kindsOf(codes: string): ChangeKind[] | null {
    let kinds = this.kindsByCodes.get(codes);
    if (kinds === undefined) {
      const listed = listedCodes(new Set(codes.split('+')));
      kinds = listed.length === 0 ? null : listed.flatMap((code) => CHANGE_KINDS[code] ?? []);
      this.kindsByCodes.set(codes, kinds);
    }
    return kinds;
  }
}

/**
 * Where `cm status --xml` listed each kind: its categories in their order (changed, deleted, moved, added), an item in
 * several merged in that order. The kinds of an item printed twice keep it.
 */
const XML_CATEGORY: Partial<Record<ChangeKind, number>> = { deleted: 1, locallyDeleted: 1, moved: 2, locallyMoved: 2, added: 3, private: 3, ignored: 3 };
const categoryRank = (kind: ChangeKind): number => XML_CATEGORY[kind] ?? 0;

/** `listed` with what `other`, the same item printed again, adds: its kinds, and whatever `listed` doesn't say. */
function withTheOther(listed: PendingChange, other: PendingChange): void {
  // A new array: kinds are shared by every change with the same codes.
  if (other.kinds.some((kind) => !listed.kinds.includes(kind))) {
    listed.kinds = [...new Set([...listed.kinds, ...other.kinds])].sort((a, b) => categoryRank(a) - categoryRank(b));
  }
  // Only the fields it has: nothing empty goes over IPC.
  for (const field of ['oldPath', 'similarityPercent', 'mergeInfo', 'changelist'] as const) {
    if (listed[field] === undefined && other[field] !== undefined) Object.assign(listed, { [field]: other[field] });
  }
}

/**
 * The codes of an item as `cm status --xml` listed them, which is what Changes has always shown: it listed an item
 * under each category its codes put it in (changed, deleted, moved, added), with the codes of that category, and left
 * out an item in none (a cloaked folder, `CL`). So a deleted item is only deleted, an added or private one only that,
 * even when also changed, and a moved one is moved plus what else it is.
 */
export function listedCodes(codes: ReadonlySet<string>): string[] {
  if (codes.has('LD')) return ['LD'];
  if (codes.has('DE')) return ['DE'];
  const isChanged = (codes.has('CO') || codes.has('CH') || codes.has('RP')) && !codes.has('CP');
  const isAdded = codes.has('AD') || codes.has('PR') || codes.has('CP') || codes.has('IG');
  const isMoved = codes.has('MV') || codes.has('LM');
  const listed: string[] = [];
  if (isChanged || isAdded) listed.push(...stateCodes(codes));
  if (isMoved) listed.push(codes.has('LM') ? 'LM' : 'MV');
  return listed;
}

/** What a changed or added item is listed as: what it is, and for a checkout or a change, what else it carries. */
function stateCodes(codes: ReadonlySet<string>): string[] {
  for (const only of ['AD', 'IG', 'PR']) if (codes.has(only)) return [only];
  if (!codes.has('CO') && !codes.has('CH')) return [codes.has('RP') ? 'RP' : 'CP'];
  const state = codes.has('CO') && codes.has('CH') ? ['CO', 'CH'] : [codes.has('CO') ? 'CO' : 'CH'];
  const carried = codes.has('CO') ? ['CP', 'RP', ...(codes.has('CH') ? ['CL'] : [])] : ['CP', 'RP', 'CL', 'HC'];
  return [...state, ...carried.filter((code) => codes.has(code))];
}

/**
 * `85%`, `85.5%`: `cm` prints the similarity in its culture's format, so the decimal separator may be a comma and the
 * percent sign another; only the number is read, rounded.
 */
function similarityPercentOf(similarity: string): number {
  const number = /\d+(?:[.,]\d+)?/.exec(similarity)?.[0];
  return number ? Math.round(Number.parseFloat(number.replace(',', '.'))) : 0;
}
