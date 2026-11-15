// Joins a before and an after screenshot into one labeled picture, for a release note (the `release-notes` skill,
// "Before and after"): side by side, or one above the other when the shots are wide strips (`beforeAfterLayout`).
// Usage: npx electron scripts/beforeAfter.mjs [--scale=2] <before.png> <after.png> <output.png>
//   --scale=2   the shots were taken at twice the pixels (a high-density screen, `--hires`): labels and spacing follow
// The two shots must be the same size: the same crop of the same place, so the change is all that differs.
import { readFile, writeFile } from 'node:fs/promises';
import { app, BrowserWindow, nativeImage } from 'electron';
import { beforeAfterLayout, beforeAfterSizeError } from './build/beforeAfterLayout.mts';

const scaleOption = process.argv.find((argument) => argument.startsWith('--scale='));
const pixelRatio = scaleOption ? Number(scaleOption.slice('--scale='.length)) : 1;
// Electron's own arguments come first: the script's are the last three.
const [beforePath, afterPath, outputPath] = process.argv.filter((argument) => argument !== scaleOption).slice(-3);

/** A picture of the light theme's page, its labels in its secondary text: the release notes' pictures are light. */
const COLORS = { page: '#ffffff', label: '#5b6270', border: '#d9dde3' };

function pageHtml(layout, before, after) {
  const label = (panel) =>
    `<div style="position:absolute;left:${panel.x}px;top:${panel.y - layout.labelHeight}px;height:${layout.labelHeight}px;line-height:${layout.labelHeight}px;font:600 ${13 * pixelRatio}px -apple-system,'Segoe UI',system-ui,sans-serif;color:${COLORS.label}">${panel.label}</div>`;
  const shot = (panel, data) =>
    `<img src="data:image/png;base64,${data}" style="position:absolute;left:${panel.x}px;top:${panel.y}px;width:${panel.width}px;height:${panel.height}px;outline:${pixelRatio}px solid ${COLORS.border};outline-offset:-${pixelRatio}px">`;
  const [first, second] = layout.panels;
  return `<!doctype html><body style="margin:0;width:${layout.width}px;height:${layout.height}px;background:${COLORS.page};position:relative;overflow:hidden">${label(first)}${shot(first, before)}${label(second)}${shot(second, after)}</body>`;
}

async function main() {
  if (!beforePath || !afterPath || !outputPath) throw new Error('Usage: npx electron scripts/beforeAfter.mjs [--scale=2] <before.png> <after.png> <output.png>');
  const [before, after] = await Promise.all([readFile(beforePath), readFile(afterPath)]);
  const size = nativeImage.createFromBuffer(before).getSize();
  const sizeError = beforeAfterSizeError(size, nativeImage.createFromBuffer(after).getSize());
  if (sizeError) throw new Error(sizeError);
  const layout = beforeAfterLayout(size, pixelRatio);
  const window = new BrowserWindow({ show: false, useContentSize: true, width: layout.width, height: layout.height, webPreferences: { offscreen: true } });
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(pageHtml(layout, before.toString('base64'), after.toString('base64')))}`);
  const picture = await window.webContents.capturePage({ x: 0, y: 0, width: layout.width, height: layout.height });
  await writeFile(outputPath, picture.toPNG());
  console.log(`${outputPath}: ${layout.width}×${layout.height}, ${layout.direction === 'row' ? 'side by side' : 'one above the other'}`);
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
