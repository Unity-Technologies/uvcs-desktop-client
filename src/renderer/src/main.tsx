import { focusManager } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { preloadCommentEditor } from './components/commentEditor/CommentField';
import { AppErrorBoundary } from './app/errors/AppErrorBoundary';
import { reportUnexpectedErrors } from './app/errors/reportUnexpectedErrors';
import { guardUnloading } from './app/navigation/leaveGuard';
import { reportShownView } from './app/navigation/reportShownView';
import { isSettingUpCm, useCmRuntimeStore } from './app/cmSetup/cmRuntimeStore';
import { prefetchStartupQueries } from './app/startup/prefetchStartupQueries';
import { openPageWindowFromAddress } from './app/pageWindow/openPageWindowFromAddress';
import { openPlaceFromAddress } from './app/workspace/openPlaceFromAddress';
import { exposePageZoom } from './app/shell/exposePageZoom';
import { markReadsInFlight } from './app/markReadsInFlight';
import { queryClient } from './app/queryClient';
import { trackPointerReturnFocus } from './lib/inputModality';
import { WINDOW_CHROME } from './lib/platform';
import './styles/global.css';

// First, so an error of the steps below is told too.
reportUnexpectedErrors();

// Warm up the syntax highlighter in the background so the first diff renders without a delay.
setTimeout(() => {
  void import('@pierre/diffs').then(({ preloadHighlighter }) => preloadHighlighter({ themes: ['pierre-light', 'pierre-dark'], langs: [] }));
}, 1500);

// And the comment editor's code (CodeMirror), so the first comment field shows it at once, not its plain stand-in.
setTimeout(preloadCommentEditor, 2500);

document.documentElement.dataset.chrome = WINDOW_CHROME;
exposePageZoom();
markReadsInFlight(queryClient);
// TEMPORARY diagnostics for PR #359's Windows duplicate: who fetches a listing, and the watcher's and focus' events.
queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== 'updated' || event.action.type !== 'fetch') return;
  const key = JSON.stringify(event.query.queryKey);
  if (!key.includes('"explorer"') && !key.includes('"pendingChanges"')) return;
  Error.stackTraceLimit = 40;
  console.info(`[diag] fetch ${key}\n${(new Error().stack ?? '').split('\n').slice(10, 30).map((frame) => frame.replace(/\(?file:.*\//, '(')).join('\n')}`);
});
focusManager.subscribe((focused) => console.info(`[diag] focus ${focused}`));
window.uvcs.on('workspaceChanged', (change) => console.info(`[diag] workspaceChanged ${JSON.stringify(change)}`));
guardUnloading();
trackPointerReturnFocus();
// A page window shows one page of its workspace: no view to report, nor a first screen to read ahead.
if (!openPageWindowFromAddress()) {
  openPlaceFromAddress();
  reportShownView();
  // While the app's own `cm` is set up, nothing can read the first screen: its views ask once they show.
  if (!isSettingUpCm(useCmRuntimeStore.getState().status)) void prefetchStartupQueries();
}

const root = createRoot(document.getElementById('root')!);
// Synchronously: the window shows on the page's first frame (`ready-to-show`), which otherwise can come before React's
// first commit and show the background alone (ARCHITECTURE.md "Start-up").
flushSync(() =>
  root.render(
    <StrictMode>
      {/* The last resort, for an error outside the app's own boundary (a dialog's, a toast's). */}
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  ),
);
