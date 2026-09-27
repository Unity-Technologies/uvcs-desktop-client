import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { guardUnloading } from './app/navigation/leaveGuard';
import { prefetchStartupQueries } from './app/startup/prefetchStartupQueries';
import { trackPointerReturnFocus } from './lib/inputModality';
import { WINDOW_CHROME } from './lib/platform';
import './styles/global.css';

// Warm up the syntax highlighter in the background so the first diff renders without a delay.
setTimeout(() => {
  void import('@pierre/diffs').then(({ preloadHighlighter }) => preloadHighlighter({ themes: ['pierre-light', 'pierre-dark'], langs: [] }));
}, 1500);

document.documentElement.dataset.chrome = WINDOW_CHROME;
guardUnloading();
trackPointerReturnFocus();
prefetchStartupQueries();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
