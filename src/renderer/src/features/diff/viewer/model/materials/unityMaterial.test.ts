import { describe, expect, it } from 'vitest';
import { unityMaterialYaml, type RenderPipeline } from './testing/unityMaterialYaml';
import { readUnityMaterial } from './unityMaterial';

const BARK = '6d1e0c9b8a7f4e3d2c1b0a9f8e7d6c5b';
const BARK_NORMAL = '1a2b3c4d5e6f708192a3b4c5d6e7f809';

describe('readUnityMaterial', () => {
  it.each<RenderPipeline>(['urp', 'hdrp', 'builtIn'])('reads the base map, its tiling and offset, the normal map and the base color of a %s material', (pipeline) => {
    const material = readUnityMaterial(
      unityMaterialYaml({ name: 'Bark', pipeline, baseMap: { guid: BARK, scale: [2, 3], offset: [0.5, 0.25] }, normalMap: { guid: BARK_NORMAL }, baseColor: [0.8, 0.6, 0.4, 1] }),
    );
    expect(material).toEqual({
      baseMap: { guid: BARK, scale: [2, 3], offset: [0.5, 0.25] },
      normalMap: { guid: BARK_NORMAL, scale: [1, 1], offset: [0, 0] },
      baseColor: [0.8, 0.6, 0.4, 1],
      alpha: 'opaque',
      cutoff: 0.5,
      doubleSided: false,
    });
  });

  it.each<RenderPipeline>(['urp', 'hdrp', 'builtIn'])('reads an alpha-clipped %s material with its cutoff', (pipeline) => {
    expect(readUnityMaterial(unityMaterialYaml({ name: 'Leaf', pipeline, alpha: 'clip', cutoff: 0.33 }))).toMatchObject({ alpha: 'clip', cutoff: 0.33 });
  });

  it.each<RenderPipeline>(['urp', 'hdrp', 'builtIn'])('reads a transparent %s material', (pipeline) => {
    expect(readUnityMaterial(unityMaterialYaml({ name: 'Glass', pipeline, alpha: 'blend' }))).toMatchObject({ alpha: 'blend' });
  });

  it.each<RenderPipeline>(['urp', 'hdrp'])('reads a double-sided %s material', (pipeline) => {
    expect(readUnityMaterial(unityMaterialYaml({ name: 'Leaf', pipeline, doubleSided: true }))?.doubleSided).toBe(true);
  });

  it("reads the Built-in pipeline's fade mode as transparent", () => {
    const fade = unityMaterialYaml({ name: 'Smoke', pipeline: 'builtIn' }).replace('- _Mode: 0', '- _Mode: 2');
    expect(readUnityMaterial(fade)?.alpha).toBe('blend');
  });

  it('takes the first base map set: a null reference sets none', () => {
    // A URP material whose `_BaseMap` was cleared still has the `_MainTex` a Built-in material it was converted from had.
    const converted = unityMaterialYaml({ name: 'Rock', pipeline: 'urp', baseMap: { guid: BARK } }).replace(/(- _BaseMap:\n\s+m_Texture: )\{[^}]*\}/, '$1{fileID: 0}');
    expect(readUnityMaterial(converted)?.baseMap?.guid).toBe(BARK);
    expect(readUnityMaterial(unityMaterialYaml({ name: 'Plain', pipeline: 'urp' }))).toMatchObject({ baseMap: null, normalMap: null, baseColor: [1, 1, 1, 1] });
  });

  it('reads a material Windows saved, with CRLF line ends', () => {
    const crlf = unityMaterialYaml({ name: 'Bark', pipeline: 'urp', baseMap: { guid: BARK } }).replaceAll('\n', '\r\n');
    expect(readUnityMaterial(crlf)?.baseMap?.guid).toBe(BARK);
  });

  it('reads nothing from a file that holds no material', () => {
    expect(readUnityMaterial('fileFormatVersion: 2\nguid: 0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f\n')).toBeNull();
    expect(readUnityMaterial('')).toBeNull();
  });
});
