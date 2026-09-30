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
contextBridge.exposeInMainWorld('startupMarks', { read: () => ({ ...marks }) });
