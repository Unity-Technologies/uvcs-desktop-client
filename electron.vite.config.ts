import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
  },
  renderer: {
    plugins: [react()],
    // Pierre diffs tokenizes with Shiki; pre-bundle it for the browser.
    optimizeDeps: { include: ['@pierre/diffs', '@pierre/diffs/react', '@pierre/diffs/edit'] },
    resolve: {
      alias: { ...sharedAlias, '@renderer': resolve(__dirname, 'src/renderer/src') },
    },
    optimizeDeps: { include: ['@pierre/diffs', '@pierre/diffs/react'] },
  },
});
