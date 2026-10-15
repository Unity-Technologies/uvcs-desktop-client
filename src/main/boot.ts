// The main process's entry (package.json's `main`): it turns Node's compile cache on, then loads the app (`index.ts`),
// so V8 compiles the app's bundle from the cache that the previous launch left instead of from its source: the main
// module then evaluates 5-10 ms sooner. The cache lives in the user data folder, outside app.asar and writable; Node
// checks each entry against the source it was compiled from, so an update of the app only compiles it again once.
// A cache that can't be used is skipped: `enableCompileCache` returns why and never throws (development builds say it).
import { constants, enableCompileCache } from 'node:module';
import { join } from 'node:path';
import { app } from 'electron';

const cache = enableCompileCache(join(app.getPath('userData'), 'compile-cache'));
if (!app.isPackaged && cache.status === constants.compileCacheStatus.FAILED) {
  console.warn('[start-up] No compile cache:', cache.message);
}
// A separate bundle, loaded once the cache is on (electron.vite.config.ts builds both, `boot.test.ts`), synchronously:
// an error as it loads fails the launch as an error in the main module does.
require('./index.js');
