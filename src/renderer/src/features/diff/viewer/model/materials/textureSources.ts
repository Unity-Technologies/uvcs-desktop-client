// What each loader's textures stand for (`TextureSource`), told from what the loader leaves on them: FBXLoader sets a
// texture's `ID` to its Texture object's, whose stored paths `readFbxTextureFiles` read; GLTFLoader associates each
// texture with its index in the glTF, whose image the JSON names. `noTextureLoading` keeps the path a loader asked for
// in `userData.path`, for an FBX texture whose object can't be told.

import type { Texture } from 'three';
import type { GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { FbxTextureFile } from '../fbxTextureFiles';
import { gltfImagePlace, gltfTextureImage } from '../gltfJson';
import { fileNameOf } from '../noTextureLoading';
import type { TextureSource } from './fileMaterials';

/** An FBX texture: the file Unity searches for by the name it stores, with the paths it stores (relative first). */
export function fbxTextureSource(files: ReadonlyMap<number, FbxTextureFile>): TextureSource {
  return (texture: Texture) => {
    const stored = files.get((texture as Texture & { ID?: number }).ID ?? Number.NaN);
    const asked = texture.userData.path as string | undefined;
    const paths = [...new Set([stored?.relativeFileName, stored?.fileName, asked].filter((path): path is string => path !== undefined && path !== ''))];
    const [first] = paths;
    return first === undefined ? null : { kind: 'named', name: fileNameOf(first), storedPaths: paths };
  };
}

/** A glTF texture: its image, in the file or in a file beside it. */
export function gltfTextureSource(parser: Pick<GLTFParser, 'associations' | 'json'>): TextureSource {
  return (texture: Texture) => {
    const index = parser.associations.get(texture)?.textures;
    const image = index === undefined ? null : gltfTextureImage(parser.json, index);
    const place = image === null ? null : gltfImagePlace(parser.json, image);
    if (image === null || !place) return null;
    return place.kind === 'inFile' ? { kind: 'gltfImage', image } : { kind: 'beside', path: place.path };
  };
}
