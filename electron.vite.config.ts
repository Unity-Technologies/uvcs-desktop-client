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
    // Pierre's highlighting worker loads its languages in chunks, which only a module worker can.
    worker: { format: 'es' },
    resolve: {
      alias: { ...sharedAlias, '@renderer': resolve(__dirname, 'src/renderer/src') },
    },
  },
});
