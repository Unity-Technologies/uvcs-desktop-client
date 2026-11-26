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
import { bringStoredWindowSettings } from './app/settings/windowKeptSettings';
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
// Before `openPlaceFromAddress`, which drops the address's query, the zoom the window opened at with it.
exposePageZoom();
markReadsInFlight(queryClient);
guardUnloading();
trackPointerReturnFocus();
// What this window's storage kept before the app's settings held it (sync remotes, home projects), handed over once.
void bringStoredWindowSettings();
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
