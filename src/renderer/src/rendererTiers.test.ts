import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/**
 * The renderer's tiers (CLAUDE.md "Architecture in one screen"): `lib/` holds pure helpers and `ui/` the design
 * system, so neither reaches up into the API, the shell, the features or the domain-aware components. What they need
 * from above is handed to them (`setAvatarPictureSource`), or lives a tier up (`app/navigation/useBackButtons`).
 */
const RENDERER_SOURCE = __dirname;

const FORBIDDEN: Record<string, string[]> = {
  lib: ['api', 'app', 'features', 'components', 'ui'],
  ui: ['api', 'app', 'features', 'components'],
};

function importedModules(source: string): string[] {
  return [...source.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]!);
}

/** The top folder of the renderer (`lib`, `ui`, `features`...) a module of `file` lives in. */
function tierOf(file: string, module = '.'): string {
  return relative(RENDERER_SOURCE, resolve(dirname(file), module)).split(sep)[0]!;
}

describe('renderer tiers', () => {
  it.each(Object.entries(FORBIDDEN))('%s imports nothing from the tiers above it', (tier, above) => {
    const sources = filesUnder(resolve(RENDERER_SOURCE, tier), isAppSource);
    const reachingUp = sources.flatMap((file) =>
      importedModules(readFileSync(file, 'utf8'))
        .filter((module) => module.startsWith('.') && above.includes(tierOf(file, module)))
        .map((module) => `${relative(RENDERER_SOURCE, file)}: ${module}`),
    );

    expect(sources.length).toBeGreaterThan(10);
    expect(reachingUp).toEqual([]);
  });

  it('tells the tier a module lives in', () => {
    const file = resolve(RENDERER_SOURCE, 'ui', 'table', 'DataTable.tsx');
    expect(tierOf(file, '../../lib/selection')).toBe('lib');
    expect(tierOf(file, './column')).toBe('ui');
  });
});
