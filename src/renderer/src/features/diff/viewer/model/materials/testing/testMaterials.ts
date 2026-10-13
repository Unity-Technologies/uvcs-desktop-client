// Materials as tests state them: a file's material by its slot name, white and opaque unless told otherwise.

import type { FileMaterial, FileTexture, TextureUse } from '../../parsedModel';

export function fileMaterial(name: string, overrides: Partial<FileMaterial> = {}): FileMaterial {
  return { name, color: [1, 1, 1], opacity: 1, baseMap: null, normalMap: null, alpha: 'opaque', cutoff: 0.5, doubleSided: false, ...overrides };
}

/** A texture as a material maps it, untransformed. */
export function use(texture: FileTexture): TextureUse {
  return { texture, repeat: [1, 1], offset: [0, 0], rotation: 0 };
}

/** A texture an FBX names by file name. */
export function named(name: string, storedPaths: string[] = []): Extract<FileTexture, { kind: 'named' }> {
  return { kind: 'named', name, storedPaths };
}
