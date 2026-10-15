import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

/**
 * The main process starts at `boot.ts`, which turns the compile cache on before it loads the app's bundle (ARCHITECTURE.md
 * "Start-up"): package.json's `main` names its build, and the build makes both bundles, the app's under the name
 * `boot.ts` loads.
 */
describe('the main process entry', () => {
  it('is the boot bundle, which the build makes beside the app bundle it loads', () => {
    expect(JSON.parse(read('package.json')).main).toBe('out/main/boot.js');
    const config = read('electron.vite.config.ts');
    expect(config).toContain("boot: resolve(__dirname, 'src/main/boot.ts')");
    expect(config).toContain("index: resolve(__dirname, 'src/main/index.ts')");
    expect(read('src/main/boot.ts')).toContain("require('./index.js')");
  });
});
