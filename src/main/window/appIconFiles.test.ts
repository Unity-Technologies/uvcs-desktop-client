import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appIconSvg } from '@shared/appMark';

/**
 * The icons the installers carry, made by `npm run icons` (scripts/icons/makeAppIcons.mjs) and committed: electron-builder
 * finds them, they were made from today's mark, and each holds the sizes its OS asks for.
 */
const ROOT = join(__dirname, '..', '..', '..');
const BUILD = join(ROOT, 'build');
/** A text file as committed: a Windows checkout may have turned its line breaks into CRLF. */
const readText = (file: string): string => readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const builderConfig = readText(join(ROOT, 'electron-builder.yml'));

/** The `icon:` electron-builder.yml gives one OS's section. */
function builderIcon(section: 'mac' | 'win' | 'linux'): string | undefined {
  return builderConfig.match(new RegExp(`^${section}:\\n(?:  .*\\n)*?  icon: (\\S+)`, 'm'))?.[1];
}

/** A PNG's width and height, from its IHDR chunk. */
function pngSize(png: Buffer): [number, number] {
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

/** An .icns's entries: each type and the size of its PNG. */
function icnsEntries(icns: Buffer): [string, number][] {
  expect(icns.subarray(0, 4).toString('ascii')).toBe('icns');
  expect(icns.readUInt32BE(4)).toBe(icns.length);
  const entries: [string, number][] = [];
  for (let offset = 8; offset < icns.length; offset += icns.readUInt32BE(offset + 4)) {
    entries.push([icns.subarray(offset, offset + 4).toString('ascii'), pngSize(icns.subarray(offset + 8))[0]]);
  }
  return entries;
}

/** An .ico's images: the size its directory names and the size of the PNG it points at. */
function icoImages(ico: Buffer): { named: number; drawn: [number, number] }[] {
  expect([ico.readUInt16LE(0), ico.readUInt16LE(2)]).toEqual([0, 1]);
  return Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + 16 * index;
    return { named: ico.readUInt8(entry) || 256, drawn: pngSize(ico.subarray(ico.readUInt32LE(entry + 12))) };
  });
}

describe('the app icons', () => {
  it('are the ones electron-builder.yml gives each OS, and they exist', () => {
    expect([builderIcon('mac'), builderIcon('win'), builderIcon('linux')]).toEqual(['build/icon.icns', 'build/icon.ico', 'build/icons']);
    for (const file of ['icon.icns', 'icon.ico', 'icons', 'icon-macOS.png']) expect(existsSync(join(BUILD, file)), file).toBe(true);
  });

  it("were made from the app's mark as it is now (run `npm run icons` after changing it)", () => {
    expect(readText(join(BUILD, 'icon-macOS.svg'))).toBe(appIconSvg('macOS'));
    expect(readText(join(BUILD, 'icon.svg'))).toBe(appIconSvg('edgeToEdge'));
  });

  it('give macOS every size from 16 to 512 points, at 1x and 2x', () => {
    expect(icnsEntries(readFileSync(join(BUILD, 'icon.icns')))).toEqual([
      ['icp4', 16],
      ['icp5', 32],
      ['ic11', 32],
      ['ic12', 64],
      ['ic07', 128],
      ['ic08', 256],
      ['ic13', 256],
      ['ic09', 512],
      ['ic14', 512],
      ['ic10', 1024],
    ]);
  });

  it('give Windows every size from 16 to 256 pixels', () => {
    const images = icoImages(readFileSync(join(BUILD, 'icon.ico')));

    expect(images.map(({ named }) => named)).toEqual([16, 24, 32, 48, 64, 128, 256]);
    for (const { named, drawn } of images) expect(drawn).toEqual([named, named]);
  });

  it('give Linux 256 and 512 pixels, and the Dock of an unpackaged app 512', () => {
    for (const size of [256, 512]) expect(pngSize(readFileSync(join(BUILD, 'icons', `${size}x${size}.png`)))).toEqual([size, size]);
    expect(pngSize(readFileSync(join(BUILD, 'icon-macOS.png')))).toEqual([512, 512]);
  });
});
