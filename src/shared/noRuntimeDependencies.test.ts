import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from './testing/filesUnder';

/**
 * `shared/` is loaded by the main process, the preload and the renderer alike, so it has no runtime dependencies: it
 * imports only its own modules. Its test helpers (`shared/testing/`) run under Node only, in tests.
 */
const SHARED_DIRECTORY = __dirname;

function importedModules(source: string): string[] {
  return [...source.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]!);
}

describe('shared', () => {
  it('imports only its own modules', () => {
    const sources = filesUnder(SHARED_DIRECTORY, isAppSource).filter((file) => !relative(SHARED_DIRECTORY, file).startsWith(`testing${sep}`));
    const outside = sources.flatMap((file) =>
      importedModules(readFileSync(file, 'utf8'))
        .filter((module) => !module.startsWith('.'))
        .map((module) => `${relative(SHARED_DIRECTORY, file)}: ${module}`),
    );

    expect(sources.length).toBeGreaterThan(10);
    expect(outside).toEqual([]);
  });

  it('finds what a module imports', () => {
    expect(importedModules("import type { A } from './a';\nimport {\n  B,\n} from 'electron';\nexport { C } from '../c';")).toEqual(['./a', 'electron', '../c']);
  });
});
