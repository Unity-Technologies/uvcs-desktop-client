// Pierre's highlighting worker, started from here rather than from its file's URL: its chunks import `worker.js` back,
// and a development server loads it once only when it's imported as they import it (`pierreHighlightWorker.test.ts`).
import '@pierre/diffs/worker/worker.js';
