import type { ChangeKind, Changelist, ItemType, PendingChange, PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import { withForwardSlashes } from '../files/workspacePaths';
import { child, children, integer, parseXml, text } from './parseXml';

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

const ITEM_TYPES: Record<string, ItemType> = {
  enTextFile: 'file',
  enBinaryFile: 'binaryFile',
  enDirectory: 'directory',
  enSymLink: 'symlink',
};

/**
 * Parses `cm status --xml`, with or without `--changelists`. The same item can be listed
 * several times (e.g. moved and changed), so entries are merged by path. Paths come with the OS's separators.
 */
export function parsePendingChanges(xml: string, platform: NodeJS.Platform = process.platform): PendingChangesSnapshot {
  const status = child(parseXml(xml, ['Change', 'Changelist']), 'StatusOutput');
  const loadedChangeset = integer(child(child(status, 'WorkspaceStatus'), 'Status')?.Changeset);
  const changelistNodes = children(child(status, 'Changelists'), 'Changelist');
  const groups = changelistNodes.length > 0 ? changelistNodes : [{ Name: DEFAULT_CHANGELIST, Changes: child(status, 'Changes') }];
  const changesByPath = new Map<string, PendingChange>();
  const changelists: Changelist[] = [];

  for (const group of groups) {
    const name = text(group.Name);
    const changelist = name === DEFAULT_CHANGELIST ? undefined : name;
    if (changelist) changelists.push({ name: changelist, description: text(group.Description) });

    for (const node of children(child(group, 'Changes'), 'Change')) {
      const change = toPendingChange(node, changelist, platform);
      const existing = changesByPath.get(change.path);
      changesByPath.set(change.path, existing ? mergeChanges(existing, change) : change);
    }
  }

  return { loadedChangeset, changelists, changes: [...changesByPath.values()] };
}

function toPendingChange(node: Record<string, unknown>, changelist: string | undefined, platform: NodeJS.Platform): PendingChange {
  const kinds = text(node.Type)
    .split('+')
    .map((code) => CHANGE_KINDS[code])
    .filter((kind): kind is ChangeKind => Boolean(kind));
  const similarity = Number.parseFloat(text(node.SimilarityPerUnit));

  return withOptionalFields(
    { path: withForwardSlashes(text(node.Path), platform), kinds, itemType: ITEM_TYPES[text(node.RevisionType)] ?? 'file', size: integer(node.Size, 0), lastModified: knownDate(text(node.LastModified)) },
    {
      oldPath: withForwardSlashes(text(node.OldPath), platform) || undefined,
      mergeInfo: text(node.MergesInfo).replace(/^\s*\(|\)\s*$/g, '') || undefined,
      similarityPercent: similarity > 0 ? Math.round(similarity * 100) : undefined,
      changelist,
    },
  );
}

/** `cm` dates a move it has no file date for as the year 1: no date. */
function knownDate(date: string): string {
  return date.startsWith('0001-') ? '' : date;
}

function mergeChanges(first: PendingChange, second: PendingChange): PendingChange {
  const { path, kinds, itemType, size } = first;
  const lastModified = first.lastModified || second.lastModified;
  return withOptionalFields(
    { path, kinds: [...new Set([...kinds, ...second.kinds])], itemType, size, lastModified },
    {
      oldPath: first.oldPath ?? second.oldPath,
      mergeInfo: first.mergeInfo ?? second.mergeInfo,
      similarityPercent: first.similarityPercent ?? second.similarityPercent,
      changelist: first.changelist ?? second.changelist,
    },
  );
}

type OptionalFields = Pick<PendingChange, 'oldPath' | 'mergeInfo' | 'similarityPercent' | 'changelist'>;

/**
 * Adds only the optional fields a change has: most have none, and 100,000 changes copied to the window (over IPC,
 * then into the page) take a quarter longer with four empty fields each.
 */
function withOptionalFields(change: PendingChange, optional: OptionalFields): PendingChange {
  if (optional.oldPath !== undefined) change.oldPath = optional.oldPath;
  if (optional.mergeInfo !== undefined) change.mergeInfo = optional.mergeInfo;
  if (optional.similarityPercent !== undefined) change.similarityPercent = optional.similarityPercent;
  if (optional.changelist !== undefined) change.changelist = optional.changelist;
  return change;
}
