// Writes the textures sandbox's files (`scripts/sandboxes/textures.sh`) as they stand after one step of its history:
// textures in the formats the browser can't decode (TGA, TIFF, PSD, EXR, HDR), painted in code, so the image diff
// shows each one changed, resized, added and deleted, a high dynamic range sky brighter than white, and the
// Photoshop files it can't read (saved without "Maximize Compatibility", in CMYK).
// Usage (textures.sh bundles it with esbuild first): node writeTextures.mjs <step> <workspace>

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { writeExr, writeHdr, writeTga, writeTiff, type Pixel } from '../../../src/renderer/src/lib/images/testing/imageWriters';
import { writePsd } from '../../../src/renderer/src/lib/images/testing/psdWriter';

type Step = 'initial' | 'repaint' | 'retouch';

const SIZE = 256;

/** Wooden planks, a dark seam every 32 px; `stencil` paints a red cross on them. */
const crate =
  ({ hue, stencil }: { hue: number; stencil: boolean }): Pixel =>
  (x, y) => {
    const grain = Math.sin(y / 5 + Math.sin(x / 17) * 2) * 18;
    const seam = y % 32 < 2 ? -60 : 0;
    const onCross = stencil && Math.abs(Math.abs(x - SIZE / 2) - Math.abs(y - SIZE / 2)) < 10 && Math.abs(x - SIZE / 2) < 70;
    if (onCross) return [200, 30, 30, 255];
    // Clamped: the writers store each channel as a byte, where -5 would wrap to 251.
    const byte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
    return [byte(150 + hue + grain + seam), byte(100 + grain / 2 + seam), byte(55 - hue / 2 + seam), 255];
  };

/** A normal map of round bumps on a grid; `spacing` sets how many. */
const bumps =
  (spacing: number): Pixel =>
  (x, y) => {
    const dx = ((x % spacing) - spacing / 2) / (spacing / 2);
    const dy = ((y % spacing) - spacing / 2) / (spacing / 2);
    const inside = dx * dx + dy * dy < 1;
    return inside ? [128 + dx * 100, 128 + dy * 100, 220, 255] : [128, 128, 255, 255];
  };

/** A sky in linear light: blue overhead, a sun past white (values over 255 are brighter than white). */
const sky =
  ({ sunX, sunPower }: { sunX: number; sunPower: number }): Pixel =>
  (x, y) => {
    const distance = Math.hypot(x - sunX, y - 60);
    const sun = distance < 18 ? sunPower : distance < 40 ? sunPower / 8 : 0;
    return [40 + y / 3 + sun, 80 + y / 4 + sun * 0.9, 200 - y / 4 + sun * 0.7, 255];
  };

/** A character's albedo: skin, hair and a see-through background around the silhouette. */
const hero =
  ({ hair }: { hair: [number, number, number] }): Pixel =>
  (x, y) => {
    const head = Math.hypot(x - 128, y - 100) < 60;
    const body = Math.abs(x - 128) < 50 && y > 150;
    if (head && y < 70) return [...hair, 255];
    if (head) return [230, 180, 150, 255];
    if (body) return [60, 90, 160, 255];
    return [0, 0, 0, 0];
  };

const gray = (shade: (x: number, y: number) => number): Pixel => (x, y) => {
  const value = shade(x, y);
  return [value, value, value, 255];
};

function psd(width: number, height: number, pixel: Pixel, { alpha = false, realComposite = true } = {}): Uint8Array {
  return writePsd({ width, height, mode: 'rgb', alpha, compression: 'rle', layerBytes: 256, realComposite, sample: (x, y, channel) => pixel(x, y)[channel]! });
}

/** A PSD in CMYK: the header's color mode says 4, which the viewer doesn't read. */
function cmykPsd(): Uint8Array {
  const bytes = psd(64, 64, gray(() => 128));
  new DataView(bytes.buffer).setUint16(24, 4);
  return bytes;
}

/** Only the header of a TGA claiming 20000 x 20000 pixels; `version` sets a byte, so its versions differ. */
function hugeTga(version: number): Uint8Array {
  const header = writeTga(1, 1, () => [version, 0, 0, 255]);
  new DataView(header.buffer).setUint16(12, 20000, true);
  new DataView(header.buffer).setUint16(14, 20000, true);
  return header;
}

/** A PNG, RGBA, unfiltered: a signature, its header, its rows deflated, and its end, each chunk with its CRC. */
function png(width: number, height: number, pixel: Pixel): Uint8Array {
  const chunk = (type: string, data: Buffer): Buffer => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rows.set(pixel(x, y), y * (1 + width * 4) + 1 + x * 4);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
  return new Uint8Array(Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]));
}

function filesOf(step: Step): Record<string, Uint8Array | null> {
  // The retouch branches off before the repaint: only the crate and the hero change there, both against the repaint.
  const repainted = step === 'repaint';
  return {
    'Assets/Textures/Crate_Albedo.tga': writeTga(SIZE, SIZE, crate({ hue: step === 'retouch' ? -30 : repainted ? 20 : 0, stencil: repainted })),
    'Assets/Textures/Rock_Normal.tif': writeTiff(SIZE, SIZE, bumps(repainted ? 32 : 64)),
    'Assets/Textures/Sky.exr': writeExr(SIZE, 128, sky({ sunX: repainted ? 180 : 70, sunPower: repainted ? 2000 : 600 })),
    'Assets/Textures/Sunset.hdr': writeHdr(SIZE, 128, sky({ sunX: 128, sunPower: repainted ? 1200 : 300 })),
    'Assets/Characters/Hero_Albedo.psd': psd(SIZE, SIZE, hero({ hair: step === 'retouch' ? [200, 60, 20] : repainted ? [240, 200, 80] : [70, 40, 20] }), { alpha: true }),
    'Assets/Characters/Hero_Mask.psd': writePsd({ width: SIZE, height: SIZE, mode: 'gray', depth: 16, sample: (x, y) => ((x + y) % (repainted ? 32 : 64) < 16 ? 255 : 0) }),
    // Resized: a wider banner, so the modes' anchor shows.
    'Assets/UI/Banner.tga': writeTga(repainted ? 192 : 128, 64, (x, y) => [x % 32 < 16 ? 240 : 40, 120, y * 3, 255]),
    // Photoshop files the viewer can't read: saved without "Maximize Compatibility" once repainted, and one in CMYK.
    'Assets/UI/Poster.psd': psd(128, 128, gray((x) => x * 2), { realComposite: !repainted }),
    'Assets/UI/Print.psd': repainted ? cmykPsd() : psd(64, 64, gray(() => 200)),
    // Neither version paints: a PSD saved without its composite both times (its layers, which the viewer doesn't read,
    // change), and a TGA whose header claims more pixels than are decoded (the bytes past its header left out).
    'Assets/UI/Sketch.psd': writePsd({ width: 96, height: 96, mode: 'rgb', realComposite: false, layerBytes: repainted ? 300 : 200, sample: () => 0 }),
    'Assets/Textures/Huge.tga': hugeTga(repainted ? 2 : 1),
    // A PNG saved under a texture's name: the viewer goes by its content.
    'Assets/Textures/Decal.tga': png(64, 64, (x, y) => [repainted ? 40 : 220, 120, (x + y) * 2, 255]),
    // Added and deleted: a single version shows alone.
    'Assets/Textures/Moss.tga': repainted ? writeTga(128, 128, gray((x, y) => 80 + ((x * y) % 90))) : null,
    'Assets/Textures/Old_Placeholder.tif': repainted ? null : writeTiff(64, 64, gray(() => 180)),
  };
}

function write(step: Step, workspace: string): void {
  for (const [path, bytes] of Object.entries(filesOf(step))) {
    const file = join(workspace, path);
    if (bytes === null) {
      rmSync(file, { force: true });
      continue;
    }
    // Only what changed is written: cm would take a file written again with the same bytes as changed.
    if (existsSync(file) && Buffer.compare(readFileSync(file), bytes) === 0) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
}

const [step, workspace] = process.argv.slice(2);
if (!step || !workspace || !['initial', 'repaint', 'retouch'].includes(step)) throw new Error('Usage: node writeTextures.mjs <initial|repaint|retouch> <workspace>');
write(step as Step, workspace);
