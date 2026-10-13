// What the Materials look spends on textures, so a model with a hundred 8K maps still shows at once and fits the GPU:
// how many files it decodes, how large each is drawn, and what it refuses unread.

import type { ImageSize } from './textureFormats';
import type { TextureProblem } from './textureProblems';

/** The most texture files one model's look decodes; those past it say so. */
export const MAX_TEXTURE_FILES = 64;
/** Past this many textures, each is drawn at most `MANY_TEXTURES_SIDE` on its longest side, `TEXTURE_SIDE` otherwise. */
export const MANY_TEXTURES = 24;
export const TEXTURE_SIDE = 2048;
export const MANY_TEXTURES_SIDE = 1024;
/** A side past this, or more pixels than this, is refused before decoding: decoding allocates every pixel at once. */
export const MAX_TEXTURE_SIDE = 16384;
export const MAX_TEXTURE_PIXELS = 8192 * 8192;
/** A file past this isn't read at all (the read itself refuses past `MAX_MODEL_BYTES`, 100 MB, before). */
export const MAX_TEXTURE_FILE_BYTES = 256 * 1024 * 1024;

/** The longest side each texture is drawn at, for a model's look that decodes `count` of them. */
export function textureSideFor(count: number): number {
  return count > MANY_TEXTURES ? MANY_TEXTURES_SIDE : TEXTURE_SIDE;
}

/** The size to draw an image at: its own, or shrunk to `longest` on its longest side, never grown. */
export function fittedSize({ width, height }: ImageSize, longest: number): ImageSize {
  const scale = Math.min(1, longest / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Why an image of this size isn't decoded; null when it may be. */
export function sizeProblem({ width, height }: ImageSize): TextureProblem | null {
  return width > MAX_TEXTURE_SIDE || height > MAX_TEXTURE_SIDE || width * height > MAX_TEXTURE_PIXELS ? 'tooLarge' : null;
}
