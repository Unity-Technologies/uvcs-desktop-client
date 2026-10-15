import type { ContentSource } from '@shared/domain/content';
import { sourcePathOf, type DiffSide, type SiblingFinder } from './modelSiblings';

/** The model a `.meta` belongs to (`Assets/Hero.fbx.meta` → `Assets/Hero.fbx`), when it is a model's; null otherwise. */
export function modelOfMeta(path: string): string | null {
  const match = /^(.*\.(fbx|obj|gltf|glb))\.meta$/i.exec(path);
  return match ? match[1]! : null;
}

/**
 * Where to read the model beside each side of a model's `.meta`; null when neither side can find it (a merge's
 * revisions; in History, a revision under an xlink: `historyPointOf`), and then the `.meta` shows as its text only.
 * In History a side may still have no model where its `.meta` wasn't at its path then: main decides, through
 * `beside`, and reads it as empty (`metaModelView`).
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

/** How a side's model read stands: no model to read (a `.meta` added or deleted), being read, failed, read and absent, or read. */
export type MetaModelRead = 'none' | 'loading' | 'failed' | 'absent' | 'model';

/**
 * What a `.meta` shown as its model shows once its models are read: the model where a side has it (a side without one
 * shows empty); the `.meta`'s text where neither has it beside it (in History, a `.meta` moved since: absent is an
 * answer, `readBeside`); a failure only for a side that couldn't be read, once nothing is still being read.
 */
export function metaModelView(reads: Record<DiffSide, MetaModelRead>): 'loading' | 'failed' | 'text' | 'model' {
  const sides = [reads.original, reads.modified];
  if (sides.includes('loading')) return 'loading';
  if (sides.includes('failed')) return 'failed';
  return sides.includes('model') ? 'model' : 'text';
}
