// A preload `startupProbe.cjs` adds to the app's windows: before the page's own scripts run, it starts marking when
// each screen first shows, in the page's `performance.now()`. `startup.mjs` reads the marks as
// `window.startupMarks.read()`.
const { contextBridge } = require('electron');

const marks = {};
const mark = (name) => {
  if (!(name in marks)) marks[name] = performance.now();
};

function check() {
  if (document.documentElement.dataset.theme) mark('themeApplied');
  if (document.getElementById('root')?.childElementCount) mark('firstRender');
  if (document.querySelector('[aria-label="Recent"] [data-workspace-row]')) mark('homeReady');
  if (document.querySelector('[aria-label="Switch workspace"]')) mark('workspaceShown');
  const main = document.querySelector('main');
  const heading = main?.querySelector('h1');
  if (heading?.textContent.trim().startsWith('Changes') && !main.querySelector('[aria-busy="true"], [aria-label="Loading"]')) mark('changesReady');
}

new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true });
// A window created hidden shows its page once it has painted (`ready-to-show`): only then can anyone click in it.
if (document.visibilityState === 'visible') mark('visible');
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && mark('visible'));
contextBridge.exposeInMainWorld('startupMarks', { read: () => ({ ...marks }) });
