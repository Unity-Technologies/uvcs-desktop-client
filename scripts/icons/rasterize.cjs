// Run as Electron's main module by `makeAppIcons.mjs`: draws SVGs into PNGs with Chromium, so making the icons needs no
// tool beyond the Electron already installed. Its one argument is a JSON file listing `{ svg, pngFile }` jobs; each SVG
// already carries the pixel size it is drawn at (`appIconSvg`), so small sizes are drawn from the vectors, not scaled
// down from a large bitmap. A canvas keeps the icon's transparent corners, which a page screenshot would fill.
const { readFileSync, writeFileSync } = require('node:fs');
const { app, BrowserWindow } = require('electron');

const DRAW_SVG = `(async (svg) => {
  const image = new Image();
  image.src = 'data:image/svg+xml;base64,' + btoa(svg);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
})`;

async function rasterize(jobs) {
  const window = new BrowserWindow({ show: false });
  await window.loadURL('about:blank');
  for (const { svg, pngFile } of jobs) {
    const dataUrl = await window.webContents.executeJavaScript(`${DRAW_SVG}(${JSON.stringify(svg)})`);
    writeFileSync(pngFile, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
  }
}

app.dock?.hide();
app.whenReady().then(async () => {
  try {
    await rasterize(JSON.parse(readFileSync(process.argv.at(-1), 'utf8')));
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
