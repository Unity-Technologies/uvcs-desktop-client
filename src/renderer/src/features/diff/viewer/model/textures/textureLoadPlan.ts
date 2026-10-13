// What to load for each texture a version's look needs, within the budget (`budgeted`): a workspace file by its path,
// size and time written, or an image a glTF holds by its model's bytes. Pure: `useTextureStates` loads them.

import type { Side, TextureNeed } from '../materials/materialPlan';
import { textureKey, type TextureLoad } from './textureLoads';

/** An image a version's glTF holds: its bytes, a name telling its format, and an id while those bytes are kept. */
export type GltfImage = { bytes: Uint8Array; name: string; id: string };

/** By need: the load, or null for an image that doesn't read (it fails as unreadable). */
export function textureLoadsOf(workspacePath: string, needs: readonly TextureNeed[], longest: number, imageOf: (side: Side, image: number) => GltfImage | null): Map<string, TextureLoad | null> {
  const loads = new Map<string, TextureLoad | null>();
  for (const need of needs) {
    if (need.where.kind === 'file') {
      const load = { name: need.name, source: { kind: 'workspaceFile' as const, file: need.where.file }, longest, flipY: need.flipY };
      loads.set(need.id, { ...load, key: textureKey(workspacePath, load) });
      continue;
    }
    const image = imageOf(need.where.side, need.where.image);
    if (!image) {
      loads.set(need.id, null);
      continue;
    }
    const load = { name: image.name, source: { kind: 'bytes' as const, bytes: image.bytes, id: image.id }, longest, flipY: false };
    loads.set(need.id, { ...load, key: textureKey(workspacePath, load) });
  }
  return loads;
}
