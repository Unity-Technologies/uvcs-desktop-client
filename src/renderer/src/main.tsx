import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppErrorBoundary } from './app/errors/AppErrorBoundary';
import { reportUnexpectedErrors } from './app/errors/reportUnexpectedErrors';
import { guardUnloading } from './app/navigation/leaveGuard';
import { reportShownView } from './app/navigation/reportShownView';
import { prefetchStartupQueries } from './app/startup/prefetchStartupQueries';
import { openWorkspaceFromAddress } from './app/workspace/openWorkspaceFromAddress';
import { trackPointerReturnFocus } from './lib/inputModality';
import { WINDOW_CHROME } from './lib/platform';
import './styles/global.css';

// First, so an error of the steps below is told too.
reportUnexpectedErrors();

// Warm up the syntax highlighter in the background so the first diff renders without a delay.
setTimeout(() => {
  void import('@pierre/diffs').then(({ preloadHighlighter }) => preloadHighlighter({ themes: ['pierre-light', 'pierre-dark'], langs: [] }));
}, 1500);

document.documentElement.dataset.chrome = WINDOW_CHROME;
guardUnloading();
trackPointerReturnFocus();
openWorkspaceFromAddress();
reportShownView();
void prefetchStartupQueries();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The last resort, for an error outside the app's own boundary (a dialog's, a toast's). */}
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
