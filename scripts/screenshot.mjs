// Launches the built app (run `npm run build` first), performs a few steps and saves a screenshot.
// Usage: node scripts/screenshot.mjs <output.png> [step ...]
// Steps:
//   open:<workspacePath>   click a workspace on the home screen
//   click:<text>           click the first element showing <text>
//   rclick:<text>          right-click it (opens context menus)
//   dblclick:<text>        double-click it
//   key:<keys>             press keys, e.g. key:Meta+3
//   type:<text>            type text into the focused element
//   wait:<ms>              wait
//   theme:dark|light       force a theme
import { _electron as electron } from 'playwright-core';

const [output = '/tmp/uvcs.png', ...steps] = process.argv.slice(2);

const app = await electron.launch({ args: ['.'], cwd: new URL('..', import.meta.url).pathname });
const window = await app.firstWindow();
await window.setViewportSize({ width: 1400, height: 880 });
window.on('console', (message) => message.type() === 'error' && console.error('[renderer]', message.text()));
window.on('pageerror', (error) => console.error('[pageerror]', error.message));

for (const step of steps) {
  const separator = step.indexOf(':');
  const action = step.slice(0, separator);
  const value = step.slice(separator + 1);
  switch (action) {
    case 'open':
      await window.getByText(value, { exact: true }).first().click({ timeout: 15000 });
      await window.waitForTimeout(1500);
      break;
    case 'click':
      await window.getByText(value, { exact: true }).first().click({ timeout: 10000 });
      break;
    case 'rclick':
      await window.getByText(value, { exact: true }).first().click({ button: 'right', timeout: 10000 });
      break;
    case 'dblclick':
      await window.getByText(value, { exact: true }).first().dblclick({ timeout: 10000 });
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
      await window.evaluate((theme) => (document.documentElement.dataset.theme = theme), value);
      break;
    default:
      throw new Error(`Unknown step ${step}`);
  }
  await window.waitForTimeout(400);
}

await window.waitForTimeout(800);
await window.screenshot({ path: output });
await app.close();
console.log(`Saved ${output}`);
