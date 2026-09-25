import type { ChangeKind, ItemType, PendingChange, PendingChangesSnapshot } from '@shared/domain/pendingChanges';
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

const ITEM_TYPES: Record<string, ItemType> = {
  enTextFile: 'file',
  enBinaryFile: 'binaryFile',
  enDirectory: 'directory',
  enSymLink: 'symlink',
};

/**
 * Parses `cm status --xml`. The same item can be listed several times (e.g. moved and changed),
 * so entries are merged by path.
 */
export function parsePendingChanges(xml: string): PendingChangesSnapshot {
  const status = child(parseXml(xml, ['Change']), 'StatusOutput');
  const loadedChangeset = integer(child(child(status, 'WorkspaceStatus'), 'Status')?.Changeset);
  const changesByPath = new Map<string, PendingChange>();

  for (const node of children(child(status, 'Changes'), 'Change')) {
    const change = toPendingChange(node);
    const existing = changesByPath.get(change.path);
    changesByPath.set(change.path, existing ? mergeChanges(existing, change) : change);
  }

  return { loadedChangeset, changes: [...changesByPath.values()] };
}

function toPendingChange(node: Record<string, unknown>): PendingChange {
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
  };
}

function mergeChanges(first: PendingChange, second: PendingChange): PendingChange {
  return {
    ...first,
    oldPath: first.oldPath ?? second.oldPath,
    kinds: [...new Set([...first.kinds, ...second.kinds])],
    mergeInfo: first.mergeInfo ?? second.mergeInfo,
    similarityPercent: first.similarityPercent ?? second.similarityPercent,
  };
}
