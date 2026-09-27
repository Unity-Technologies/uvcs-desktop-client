import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { guardUnloading } from './app/navigation/leaveGuard';
import { trackPointerReturnFocus } from './lib/inputModality';
import './styles/global.css';

// Warm up the syntax highlighter in the background so the first diff renders without a delay.
setTimeout(() => {
  void import('@pierre/diffs').then(({ preloadHighlighter }) => preloadHighlighter({ themes: ['pierre-light', 'pierre-dark'], langs: [] }));
}, 1500);

guardUnloading();
trackPointerReturnFocus();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
