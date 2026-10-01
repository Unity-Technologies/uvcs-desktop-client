// Launches the built app (run `npm run build` first), performs a few steps and saves a screenshot.
// Usage: node scripts/screenshot.mjs [--scale=<factor>] <output.png> [step ...]
//   --scale=2 renders at twice the pixels, sharp on high-density screens (the README's screenshots)
// Steps:
//   open:<workspacePath>   click a workspace on the home screen
//   click:<text>           click the first element showing <text>
//   rclick:<text>          right-click it (opens context menus)
//   dblclick:<text>        double-click it
//   label:<name>           click the first element with that accessible name (icon buttons, e.g. label:Command log)
//   hover:<text>           hover the first element showing <text> (tooltips)
//   key:<keys>             press keys, e.g. key:Meta+3 (key:ControlOrMeta+3 on any OS)
//   type:<text>            type text into the focused element
//   wait:<ms>              wait
//   theme:dark|light       force a theme
//   size:<width>x<height>  resize the window (1400x880 by default)
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright-core';

const scaleOption = process.argv.slice(2).find((argument) => argument.startsWith('--scale='));
const [output = join(tmpdir(), 'uvcs.png'), ...steps] = process.argv.slice(2).filter((argument) => argument !== scaleOption);
// A Chromium switch: the window keeps its size in points and draws each one with more pixels.
const scaleArgs = scaleOption ? [`--force-device-scale-factor=${scaleOption.slice('--scale='.length)}`] : [];

const app = await electron.launch({ args: ['.', ...scaleArgs], cwd: fileURLToPath(new URL('..', import.meta.url)) });
const window = await app.firstWindow();

// Sizes and captures the real window rather than Playwright's emulated viewport, which would draw at one pixel
// per point whatever --scale says.
async function resizeWindow(width, height) {
  await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), {
    width,
    height,
  });
}

async function saveScreenshot(path) {
  const png = await app.evaluate(async ({ BrowserWindow }) => {
    const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage();
    return image.toPNG().toString('base64');
  });
  await writeFile(path, Buffer.from(png, 'base64'));
}

await resizeWindow(1400, 880);
window.on('console', (message) => message.type() === 'error' && console.error('[renderer]', message.text()));
window.on('pageerror', (error) => console.error('[pageerror]', error.message));

for (const step of steps) {
  const separator = step.indexOf(':');
  const action = step.slice(0, separator);
  const value = step.slice(separator + 1);
  switch (action) {
    case 'open': {
      // Recent workspaces first; otherwise look in "All workspaces".
      const recent = window.getByText(value, { exact: true }).first();
      if (!(await recent.isVisible({ timeout: 4000 }).catch(() => false))) {
        await window.getByText('All workspaces', { exact: true }).first().click();
        await window.getByPlaceholder('Find a workspace').fill(value);
      }
      await window.getByText(value, { exact: true }).first().click({ timeout: 15000 });
      await window.waitForTimeout(1500);
      break;
    }
    case 'click':
      await window.getByText(value, { exact: true }).first().click({ timeout: 10000 });
      break;
    case 'rclick':
      await window.getByText(value, { exact: true }).first().click({ button: 'right', timeout: 10000 });
      break;
    case 'dblclick':
      await window.getByText(value, { exact: true }).first().dblclick({ timeout: 10000 });
      break;
    case 'label':
      await window.getByLabel(value, { exact: true }).first().click({ timeout: 10000 });
      break;
    case 'hover':
      await window.getByText(value, { exact: true }).first().hover({ timeout: 10000 });
      break;
    case 'key':
      await window.keyboard.press(value);
      break;
    case 'type':
      await window.keyboard.type(value);
      break;
    case 'wait':
      await window.waitForTimeout(Number(value));
      break;
    case 'theme':
      // Emulates the OS appearance, so everything that follows it (code panes included) switches too.
      await window.emulateMedia({ colorScheme: value });
      break;
    case 'size': {
      const [width, height] = value.split('x').map(Number);
      await resizeWindow(width, height);
      break;
    }
    default:
      throw new Error(`Unknown step ${step}`);
  }
  await window.waitForTimeout(400);
}

await window.waitForTimeout(800);
await saveScreenshot(output);
await app.close();
console.log(`Saved ${output}`);
