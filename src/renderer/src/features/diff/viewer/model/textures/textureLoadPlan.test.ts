import { describe, expect, it } from 'vitest';
import type { TextureNeed } from '../materials/materialPlan';
import { textureLoadsOf } from './textureLoadPlan';

const fileNeed: TextureNeed = { id: 'up:Assets/bark.png', name: 'bark.png', where: { kind: 'file', file: { path: 'Assets/bark.png', size: 10, modified: 5 } }, flipY: true };
const imageNeed = (side: 'before' | 'after'): TextureNeed => ({ id: `${side}:image:0`, name: 'image 1', where: { kind: 'gltfImage', side, image: 0 }, flipY: false });
const bytes = new Uint8Array([1, 2]);

describe('textureLoadsOf', () => {
  it('loads a file by its version, and a glTF image of the version that holds it', () => {
    const asked: string[] = [];
    const loads = textureLoadsOf('/wk', [fileNeed, imageNeed('before'), imageNeed('after')], 1024, (side, image) => {
      asked.push(`${side} ${image}`);
      return side === 'before' ? { bytes, name: 'image.png', id: '7:0' } : null;
    });
    expect(asked).toEqual(['before 0', 'after 0']);
    expect(loads.get('up:Assets/bark.png')).toMatchObject({ name: 'bark.png', longest: 1024, flipY: true, source: { kind: 'workspaceFile' } });
    expect(loads.get('before:image:0')).toMatchObject({ name: 'image.png', flipY: false, source: { kind: 'bytes', bytes, id: '7:0' } });
    expect(loads.get('after:image:0')).toBeNull();
  });

  it('keys a file by its path, size and time written, and the drawing: another version or size decodes again', () => {
    const keyOf = (need: TextureNeed, longest: number) => textureLoadsOf('/wk', [need], longest, () => null).get(need.id)!.key;
    const rewritten: TextureNeed = { ...fileNeed, where: { kind: 'file', file: { path: 'Assets/bark.png', size: 10, modified: 6 } } };
    expect(keyOf(fileNeed, 2048)).toBe(keyOf(fileNeed, 2048));
    expect(keyOf(fileNeed, 2048)).not.toBe(keyOf(rewritten, 2048));
    expect(keyOf(fileNeed, 2048)).not.toBe(keyOf(fileNeed, 1024));
  });
});
