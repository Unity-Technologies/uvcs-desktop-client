import type { ChangeKind, Changelist, ItemType, PendingChange, PendingChangesSnapshot } from '@shared/domain/pendingChanges';
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
 * several times (e.g. moved and changed), so entries are merged by path.
 */
export function parsePendingChanges(xml: string): PendingChangesSnapshot {
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
      const change = toPendingChange(node, changelist);
      const existing = changesByPath.get(change.path);
      changesByPath.set(change.path, existing ? mergeChanges(existing, change) : change);
    }
  }

  return { loadedChangeset, changelists, changes: [...changesByPath.values()] };
}

function toPendingChange(node: Record<string, unknown>, changelist: string | undefined): PendingChange {
  const kinds = text(node.Type)
    .split('+')
    .map((code) => CHANGE_KINDS[code])
    .filter((kind): kind is ChangeKind => Boolean(kind));
  const similarity = Number.parseFloat(text(node.SimilarityPerUnit));

  return {
    path: text(node.Path),
    oldPath: text(node.OldPath) || undefined,
    kinds,
    itemType: ITEM_TYPES[text(node.RevisionType)] ?? 'file',
    size: integer(node.Size, 0),
    lastModified: text(node.LastModified),
    mergeInfo: text(node.MergesInfo).replace(/^\s*\(|\)\s*$/g, '') || undefined,
    similarityPercent: similarity > 0 ? Math.round(similarity * 100) : undefined,
    changelist,
  };
}

function mergeChanges(first: PendingChange, second: PendingChange): PendingChange {
  return {
    ...first,
    oldPath: first.oldPath ?? second.oldPath,
    kinds: [...new Set([...first.kinds, ...second.kinds])],
    mergeInfo: first.mergeInfo ?? second.mergeInfo,
    similarityPercent: first.similarityPercent ?? second.similarityPercent,
    changelist: first.changelist ?? second.changelist,
  };
}
