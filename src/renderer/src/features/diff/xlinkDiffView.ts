import type { DiffEntry, DiffTarget, XlinkSides } from '@shared/domain/diff';
import type { XlinkTarget } from '@shared/domain/explorer';
import { pluralize } from '../../lib/text';

/** One side of a changed xlink: what the side is, and the changeset it points to there. */
export interface XlinkSideView {
  label: string;
  changeset: string;
  /** The repository, only when it isn't the one the xlink points to now (`XlinkDiffView.repository`). */
  repository: string | null;
}

/** Where a changed xlink points, once its sides are read. */
export interface XlinkTargetView {
  /** The repository it points to (after the change, else before), with the folder of it it shows when not the root. */
  repository: string | null;
  sides: XlinkSideView[];
  /** What the sides alone don't tell: a setting that changed, or why no side shows. */
  note: string | null;
}

/** What the diff pane shows for a changed xlink (`XlinkDiff`). */
export interface XlinkDiffView {
  /** "Writable xlink", "Read-only xlink", or "Xlink" while (or where) no side is read. */
  kind: string;
  /** Null while its sides are read. */
  target: XlinkTargetView | null;
  /** The diff's files under the xlink, which the list holds too. */
  files: DiffEntry[];
  filesTitle: string;
}

/** What each side of a diff is, in the words of its target. A branch's before is where it started (`DiffApi.xlinkSides`). */
function sideLabels(target: DiffTarget): [string, string] {
  switch (target.kind) {
    case 'branch':
      return ['Where the branch started', 'Branch head'];
    case 'range':
      return [target.fromSpec, target.toSpec];
    case 'changeset':
    case 'shelve':
      return ['Before', 'After'];
  }
}

/** `sides` undefined while they're read: the files under the xlink show already. */
export function xlinkDiffView(target: DiffTarget, xlink: DiffEntry, sides: XlinkSides | undefined, entries: readonly DiffEntry[]): XlinkDiffView {
  const shown = sides && (sides.after ?? sides.before);
  const files = filesUnder(entries, xlink.path);
  return {
    kind: shown ? (shown.writable ? 'Writable xlink' : 'Read-only xlink') : 'Xlink',
    target: sides ? targetView(target, sides) : null,
    files,
    filesTitle: files.length === 0 ? 'Files changed under it' : `${pluralize(files.length, 'file')} changed under it`,
  };
}

function targetView(target: DiffTarget, { before, after }: XlinkSides): XlinkTargetView {
  const shown = after ?? before;
  const repository = shown && repositoryOf(shown);
  const [beforeLabel, afterLabel] = sideLabels(target);
  const sides = [before && sideView(beforeLabel, before, repository), after && sideView(afterLabel, after, repository)];
  return { repository, sides: sides.filter((side): side is XlinkSideView => side !== null), note: noteOf(target, before, after) };
}

function sideView(label: string, side: XlinkTarget, shownRepository: string | null): XlinkSideView {
  const repository = repositoryOf(side);
  return { label, changeset: `cs:${side.changeset}`, repository: repository === shownRepository ? null : repository };
}

function repositoryOf(side: XlinkTarget): string {
  const repository = side.server ? `${side.repository}@${side.server}` : side.repository;
  return side.path === '/' ? repository : `${repository} ${side.path}`;
}

function noteOf(target: DiffTarget, before: XlinkTarget | null, after: XlinkTarget | null): string | null {
  if (target.kind === 'shelve') return "Where it points can't be read for a shelve.";
  if (!before && !after) return "Where it points can't be read here.";
  if (!before || !after) return null;
  if (before.writable !== after.writable) return after.writable ? 'It became writable.' : 'It became read-only.';
  if (before.changeset === after.changeset && repositoryOf(before) === repositoryOf(after)) return 'It points to the same changeset; its settings changed.';
  return null;
}

/** The diff's files under the folder at `path`: what the xlinked repository changed, when `cm` lists it. */
export function filesUnder(entries: readonly DiffEntry[], path: string): DiffEntry[] {
  const prefix = `${path}/`;
  return entries.filter((entry) => entry.path.startsWith(prefix) && entry.itemType !== 'directory');
}
