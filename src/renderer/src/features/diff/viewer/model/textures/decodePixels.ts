// The formats a browser can't decode, as 8-bit RGBA pixels, the top row first: TGA, TIFF, OpenEXR and Radiance HDR
// through three's loaders (pure JavaScript, no DOM: they run in the texture worker and in tests), Photoshop's through
// `readPsd`. A high dynamic range image shows as a base map would: clamped to 0-1 and encoded as sRGB.

import { FloatType } from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import { TIFFLoader } from 'three/examples/jsm/loaders/TIFFLoader.js';
import { readPsd } from './psdImage';
import type { TextureFormat } from './textureFormats';
import type { ImageProblem } from './imageProblems';

export type PixelFormat = Exclude<TextureFormat, 'browser' | 'unsupported'>;

export type PixelsRead = { kind: 'image'; width: number; height: number; rgba: Uint8ClampedArray } | { kind: 'failed'; problem: ImageProblem };

export function decodePixels(bytes: Uint8Array, format: PixelFormat): PixelsRead {
  if (format === 'psd') {
    const psd = readPsd(bytes);
    if (psd.kind === 'image') return psd;
    return { kind: 'failed', problem: psd.kind === 'noComposite' ? 'psdWithoutComposite' : psd.kind === 'unsupportedMode' ? 'psdColorMode' : 'unreadable' };
  }
  try {
    return decodeWithThree(arrayBufferOf(bytes), format);
  } catch {
    return { kind: 'failed', problem: 'unreadable' };
  }
}

interface TexData {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

function decodeWithThree(buffer: ArrayBuffer, format: Exclude<PixelFormat, 'psd'>): PixelsRead {
  switch (format) {
    // TGALoader and TIFFLoader give RGBA bytes, the top row first.
    case 'tga':
      return image(new TGALoader().parse(buffer) as TexData, (data) => Uint8ClampedArray.from(data));
    case 'tiff':
      return image(new TIFFLoader().parse(buffer) as TexData, (data) => Uint8ClampedArray.from(data));
    // EXRLoader gives the bottom row first (as WebGL takes a data texture); HDRLoader the top one.
    case 'exr':
      return image(new EXRLoader().setDataType(FloatType).parse(buffer) as TexData, (data, width, height) => flippedRows(toSrgbBytes(data), width, height));
    case 'hdr':
      return image(new HDRLoader().setDataType(FloatType).parse(buffer) as TexData, (data) => toSrgbBytes(data));
  }
}

function image({ width, height, data }: TexData, toRgba: (data: ArrayLike<number>, width: number, height: number) => Uint8ClampedArray): PixelsRead {
  if (!(width > 0 && height > 0) || data.length < width * height * 4) return { kind: 'failed', problem: 'unreadable' };
  return { kind: 'image', width, height, rgba: toRgba(data, width, height) };
}

/** Linear floats, RGBA, as sRGB bytes; alpha stays linear. */
function toSrgbBytes(data: ArrayLike<number>): Uint8ClampedArray {
  const bytes = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) {
    const value = Math.min(1, Math.max(0, data[i]! || 0));
    bytes[i] = Math.round((i % 4 === 3 ? value : srgbOf(value)) * 255);
  }
  return bytes;
}

function srgbOf(linear: number): number {
  return linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
}

function flippedRows(rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const flipped = new Uint8ClampedArray(rgba.length);
  const row = width * 4;
  for (let y = 0; y < height; y++) flipped.set(rgba.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
  return flipped;
}

function arrayBufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : (bytes.slice().buffer as ArrayBuffer);
}
