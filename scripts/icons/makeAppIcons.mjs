// Makes the app's icons in build/ from its mark (`appIconSvg`, src/shared/appMark.ts), the artwork the About dialog
// draws: run it after changing the mark, and commit what it writes (`appIcons.test.ts` fails until the icons match).
// Usage: npm run icons
//   build/icon-macOS.svg, build/icon.svg   the sources, on macOS's icon grid and edge to edge
//   build/icon.icns                        macOS (electron-builder's mac.icon), 16 to 1024 pixels
//   build/icon.ico                         Windows (win.icon), 16 to 256 pixels
//   build/icons/<size>x<size>.png          Linux (linux.icon), and the Linux window's icon (main/window/appIcon.ts)
//   build/icon-macOS.png                   the Dock's icon while the app runs unpackaged (npm run dev, npm start)
// Chromium draws the PNGs (rasterize.cjs, run by the installed Electron); the .icns and .ico are written here, as both
// formats are a table of PNGs, so making the icons needs no other tool and works on any OS.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
import { appIconSvg } from '../../src/shared/appMark.ts';

const BUILD = fileURLToPath(new URL('../../build/', import.meta.url));

/**
 * The icns entry types that hold a PNG, by the pixels each holds (Apple's `IconFamily` types: 16 to 512 points, at 1x
 * and 2x). Not `icp6`: macOS reads it as 48 pixels, a size no Retina Mac asks for.
 */
const ICNS_TYPES = [
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
];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const LINUX_SIZES = [256, 512];
const DEV_DOCK_SIZE = 512;

/** The PNGs of one layout at each size, drawn by Chromium. */
function rasterize(layout, sizes) {
  const folder = mkdtempSync(join(tmpdir(), 'uvcs-icons-'));
  try {
    const jobs = sizes.map((size) => ({ svg: appIconSvg(layout, size), pngFile: join(folder, `${size}.png`) }));
    const jobFile = join(folder, 'jobs.json');
    writeFileSync(jobFile, JSON.stringify(jobs));
    const run = spawnSync(electron, [fileURLToPath(new URL('rasterize.cjs', import.meta.url)), jobFile], { stdio: 'inherit' });
    if (run.status !== 0) throw new Error(`rasterize.cjs failed (${run.status ?? run.signal})`);
    return new Map(sizes.map((size) => [size, readFileSync(join(folder, `${size}.png`))]));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** An .icns: the 'icns' header and its length, then each entry as its type, its length (header included) and its PNG. */
function icnsFile(pngs) {
  const entries = ICNS_TYPES.map(([type, size]) => {
    const header = Buffer.alloc(8);
    header.write(type, 0, 'ascii');
    header.writeUInt32BE(8 + pngs.get(size).length, 4);
    return Buffer.concat([header, pngs.get(size)]);
  });
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(8 + entries.reduce((total, entry) => total + entry.length, 0), 4);
  return Buffer.concat([header, ...entries]);
}

/** An .ico: a header, a 16-byte directory entry per size (0 stands for 256), then the PNGs they point at. */
function icoFile(pngs) {
  const sizes = [...pngs.keys()];
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length + 16 * sizes.length;
  const directory = sizes.map((size) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size % 256, 0);
    entry.writeUInt8(size % 256, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(pngs.get(size).length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += pngs.get(size).length;
    return entry;
  });
  return Buffer.concat([header, ...directory, ...pngs.values()]);
}

const macOS = rasterize('macOS', [...new Set([...ICNS_TYPES.map(([, size]) => size), DEV_DOCK_SIZE])]);
const edgeToEdge = rasterize('edgeToEdge', [...new Set([...ICO_SIZES, ...LINUX_SIZES])]);

mkdirSync(join(BUILD, 'icons'), { recursive: true });
writeFileSync(join(BUILD, 'icon-macOS.svg'), appIconSvg('macOS'));
writeFileSync(join(BUILD, 'icon.svg'), appIconSvg('edgeToEdge'));
writeFileSync(join(BUILD, 'icon.icns'), icnsFile(macOS));
writeFileSync(join(BUILD, 'icon.ico'), icoFile(new Map(ICO_SIZES.map((size) => [size, edgeToEdge.get(size)]))));
for (const size of LINUX_SIZES) writeFileSync(join(BUILD, 'icons', `${size}x${size}.png`), edgeToEdge.get(size));
writeFileSync(join(BUILD, 'icon-macOS.png'), macOS.get(DEV_DOCK_SIZE));
console.log(`Icons written to ${BUILD}`);
