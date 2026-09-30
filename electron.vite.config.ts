import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { thirdPartyNoticesCollector } from './scripts/build/thirdPartyNoticesPlugin';

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

// The licenses of the libraries bundled into out/, which electron-builder.yml ships beside the app.
const thirdPartyNotices = thirdPartyNoticesCollector(resolve(__dirname, 'out/THIRD_PARTY_NOTICES.txt'));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), thirdPartyNotices.plugin()],
    resolve: { alias: sharedAlias },
  },
  preload: {
    plugins: [externalizeDepsPlugin(), thirdPartyNotices.plugin()],
    resolve: { alias: sharedAlias },
  },
  renderer: {
    plugins: [react(), thirdPartyNotices.plugin()],
    // Pierre diffs tokenizes with Shiki; pre-bundle it for the browser.
    optimizeDeps: { include: ['@pierre/diffs', '@pierre/diffs/react', '@pierre/diffs/edit'] },
    // Pierre's highlighting worker loads its languages in chunks, which only a module worker can.
    worker: { format: 'es', plugins: () => [thirdPartyNotices.plugin()] },
    resolve: {
      alias: { ...sharedAlias, '@renderer': resolve(__dirname, 'src/renderer/src') },
    },
  },
});
