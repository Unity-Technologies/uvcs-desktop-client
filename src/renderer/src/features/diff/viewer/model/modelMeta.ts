import type { ContentSource } from '@shared/domain/content';
import { sourcePathOf, type DiffSide, type SiblingFinder } from './modelSiblings';

/** The model a `.meta` belongs to (`Assets/Hero.fbx.meta` → `Assets/Hero.fbx`), when it is a model's; null otherwise. */
export function modelOfMeta(path: string): string | null {
  const match = /^(.*\.(fbx|obj|gltf|glb))\.meta$/i.exec(path);
  return match ? match[1]! : null;
}

/**
 * Where to read the model beside each side of a model's `.meta`; null when neither side can find it (a history's
 * revisions, which name no folder to look in), and then the `.meta` shows as its text only.
 */
export function modelBesideMeta(findSibling: SiblingFinder, sources: Record<DiffSide, ContentSource>): Record<DiffSide, ContentSource | null> | null {
  const beside = (side: DiffSide): ContentSource | null => {
    const metaPath = sourcePathOf(sources[side]);
    const model = metaPath === null ? null : modelOfMeta(metaPath);
    return model === null || metaPath === null ? null : findSibling(side, sources[side], metaPath, model.split(/[\\/]/).pop()!);
  };
  const found = { original: beside('original'), modified: beside('modified') };
  return found.original || found.modified ? found : null;
}

/**
 * The model reads both sides need, each once, and which one each side shows: a `.meta` changed alone has the same
 * model on both sides, one query (TanStack warns of one key asked twice). A side without a model reads nothing.
 */
export function modelReadsOfSides(sources: Record<DiffSide, ContentSource | null>): { reads: (ContentSource | null)[]; readOf: Record<DiffSide, number> } {
  const keys: string[] = [];
  const reads: (ContentSource | null)[] = [];
  const readOf = (side: DiffSide): number => {
    const key = JSON.stringify(sources[side]);
    if (!keys.includes(key)) {
      keys.push(key);
      reads.push(sources[side]);
    }
    return keys.indexOf(key);
  };
  const original = readOf('original');
  return { reads, readOf: { original, modified: readOf('modified') } };
}
