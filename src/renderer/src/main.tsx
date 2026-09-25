import { preloadHighlighter } from '@pierre/diffs';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';

// Warm up the syntax highlighter so the first diff renders without a delay.
void preloadHighlighter({ themes: ['pierre-light', 'pierre-dark'], langs: [] });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
