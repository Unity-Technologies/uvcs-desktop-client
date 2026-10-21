import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { literalsOf } from '@shared/testing/sourceLiterals';

const RENDERER = join(__dirname, '..', '..', '..', '..');
const ENTRY = join(__dirname, 'pierreHighlightWorker.ts');

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

// Pierre 1.6 splits its worker into chunks that import `worker.js` back. Started by its own URL, the development
// server loads that file twice (the worker's URL without the dependency's version query, the chunks' imports with it):
// two copies each answer every request, and the one never set up fails ("Theme ... has not been resolved"). Imported
// from the app's own entry, `worker.js` loads once, the way its chunks load it. A development server can't run here,
// so this keeps the worker started from that entry.
describe("Pierre's highlighting worker", () => {
  it('starts from the app entry that imports it, never from the URL of its file in the package', () => {
    const naming = sources(RENDERER).filter((path) => literalsOf(readFileSync(path, 'utf8')).some((literal) => literal.startsWith('@pierre/diffs/worker/worker')));
    expect(naming.map((path) => relative(RENDERER, path))).toEqual([relative(RENDERER, ENTRY)]);
  });
});
