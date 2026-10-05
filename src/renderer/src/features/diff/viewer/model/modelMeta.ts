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
