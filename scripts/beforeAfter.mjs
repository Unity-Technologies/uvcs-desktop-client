// Joins a before and an after screenshot into one labeled picture, for a release note (the `release-notes` skill,
// "Before and after"): side by side, or one above the other when the shots are wide strips (`beforeAfterLayout`).
// Usage: npx electron scripts/beforeAfter.mjs [--scale=2] [--crop=x,y,width,height] [--dark] <before.png> <after.png> <output.png>
//   --crop=x,y,w,h  crops both shots (the whole window, taken at the same size) to the same box, in the shots' pixels
//   --scale=2       the shots were taken at twice the pixels (`scripts/screenshot.mjs --scale=2`): labels and spacing follow
//   --dark          frames them in the dark theme's page, for shots of the dark theme
// The two shots must be the same size: the same crop of the same place, so the change is all that differs.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, nativeImage } from 'electron';
import { beforeAfterArguments, beforeAfterLayout, beforeAfterSizeError, cropBoxError } from './build/beforeAfterLayout.mts';

/** The page around the shots, in the theme they show, its labels in its secondary text. */
const FRAMES = {
  light: { page: '#ffffff', label: '#5b6270', border: '#d9dde3' },
  dark: { page: '#1b1e23', label: '#a3aab5', border: '#3a3f47' },
};

function pageHtml(layout, before, after, colors, pixelRatio) {
  const label = (panel) =>
    `<div style="position:absolute;left:${panel.x}px;top:${panel.y - layout.labelHeight}px;height:${layout.labelHeight}px;line-height:${layout.labelHeight}px;font:600 ${13 * pixelRatio}px -apple-system,'Segoe UI',system-ui,sans-serif;color:${colors.label}">${panel.label}</div>`;
  const shot = (panel, data) =>
    `<img src="data:image/png;base64,${data}" style="position:absolute;left:${panel.x}px;top:${panel.y}px;width:${panel.width}px;height:${panel.height}px;outline:${pixelRatio}px solid ${colors.border};outline-offset:-${pixelRatio}px">`;
  const [first, second] = layout.panels;
  return `<!doctype html><body style="margin:0;width:${layout.width}px;height:${layout.height}px;background:${colors.page};position:relative;overflow:hidden">${label(first)}${shot(first, before)}${label(second)}${shot(second, after)}</body>`;
}

/** The shot in `buffer`, cropped to `box` when there is one. */
function shotOf(buffer, box, name) {
  const image = nativeImage.createFromBuffer(buffer);
  if (!box) return image;
  const error = cropBoxError(box, image.getSize());
  if (error) throw new Error(`${name}: ${error}`);
  return image.crop(box);
}

async function main() {
  const args = beforeAfterArguments(process.argv.slice(2));
  if (typeof args === 'string') throw new Error(args);
  const before = shotOf(await readFile(args.before), args.crop, 'Before');
  const after = shotOf(await readFile(args.after), args.crop, 'After');
  const size = before.getSize();
  const sizeError = beforeAfterSizeError(size, after.getSize());
  if (sizeError) throw new Error(sizeError);
  const layout = beforeAfterLayout(size, args.pixelRatio);
  const html = pageHtml(layout, before.toPNG().toString('base64'), after.toPNG().toString('base64'), args.dark ? FRAMES.dark : FRAMES.light, args.pixelRatio);
  const window = new BrowserWindow({ show: false, useContentSize: true, width: layout.width, height: layout.height, webPreferences: { offscreen: true } });
  // From a file, not a data: URL: Chromium cuts a URL at 2 MB, and two shots at twice the pixels pass it, which drops
  // the second shot from the page.
  const folder = await mkdtemp(join(tmpdir(), 'before-after-'));
  try {
    const page = join(folder, 'page.html');
    await writeFile(page, html);
    await window.loadFile(page);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
  const picture = await window.webContents.capturePage({ x: 0, y: 0, width: layout.width, height: layout.height });
  await writeFile(args.output, picture.toPNG());
  console.log(`${args.output}: ${layout.width}×${layout.height}, ${layout.direction === 'row' ? 'side by side' : 'one above the other'}`);
}

// One pixel of the picture per pixel of the page, whatever the screen it runs on.
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.whenReady().then(main).then(
  () => app.exit(0),
  (error) => {
    console.error(error.message);
    app.exit(1);
  },
);
