import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { thirdPartyNoticesCollector } from './scripts/build/thirdPartyNoticesPlugin';

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

// The licenses of the libraries bundled into out/, which electron-builder.yml ships beside the app.
const thirdPartyNotices = thirdPartyNoticesCollector(resolve(__dirname, 'out/THIRD_PARTY_NOTICES.txt'));

/**
 * `electron-vite build --mode development` bundles React's development build, as `npm run dev` serves it: StrictMode
 * runs every effect twice and warnings reach the console, so the smoke test sees what a developer sees
 * (scripts/e2e/README.md). electron-vite sets NODE_ENV to production for every build, whatever the mode.
 */
const developmentReact = (mode: string) => (mode === 'development' ? { 'process.env.NODE_ENV': JSON.stringify('development') } : {});

export default defineConfig(({ mode }) => ({
  main: {
    plugins: [externalizeDepsPlugin(), thirdPartyNotices.plugin()],
    resolve: { alias: sharedAlias },
    // `boot` turns the compile cache on, then loads `index`, the app (src/main/boot.ts).
    build: { rollupOptions: { input: { boot: resolve(__dirname, 'src/main/boot.ts'), index: resolve(__dirname, 'src/main/index.ts') } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin(), thirdPartyNotices.plugin()],
    resolve: { alias: sharedAlias },
  },
  renderer: {
    plugins: [react(), thirdPartyNotices.plugin()],
    define: developmentReact(mode),
    // Pierre diffs tokenizes with Shiki; pre-bundle it for the browser.
    optimizeDeps: { include: ['@pierre/diffs', '@pierre/diffs/react', '@pierre/diffs/edit'] },
    // Pierre's highlighting worker loads its languages in chunks, which only a module worker can.
    worker: { format: 'es', plugins: () => [thirdPartyNotices.plugin()] },
    resolve: {
      alias: { ...sharedAlias, '@renderer': resolve(__dirname, 'src/renderer/src') },
    },
  },
}));
