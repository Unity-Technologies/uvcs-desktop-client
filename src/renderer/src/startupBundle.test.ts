import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What the window loads before its first frame: every module `main.tsx` reaches through static imports, every view
 * among them (`viewRegistry`), so each view paints its own loading state at once. The heavy libraries stay out of it,
 * each loaded on first use behind a lazy boundary inside a pane already laid out (`ChangeSelectionPane`,
 * `ItemDetailsPane`, `IncomingSession`, `LoadedFileDiff`): one static import of them from a view, even of a helper,
 * would put megabytes in front of every start.
 */
const RENDERER_SOURCE = __dirname;
const SHARED_SOURCE = resolve(__dirname, '../../shared');
const ENTRY = resolve(RENDERER_SOURCE, 'main.tsx');

/** Pierre's diff viewer (with Shiki's grammars) and three.js, for 3D models: megabytes the first frame never needs. */
const HEAVY_PACKAGES = ['@pierre/diffs', 'three'];

const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

/** The modules a source imports at run time: `import type` and clauses of types only are left out, as TypeScript drops them. */
function runtimeImports(source: string): string[] {
  const statements = source.matchAll(/^\s*(?:import|export)\s+(?!type\b)([^'";]*?)\s*from\s*['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm);
  return [...statements].filter(([, clause = '']) => !onlyTypes(clause)).map((match) => (match[2] ?? match[3])!);
}

function onlyTypes(clause: string): boolean {
  const names = /^\{([^}]*)\}$/.exec(clause.trim())?.[1];
  return names !== undefined && names.split(',').every((name) => name.trim() === '' || name.trim().startsWith('type '));
}

/** A module of the app as a file, or a package by its name (`three` for `three/examples/...`). */
function resolveModule(from: string, specifier: string): string | null {
  const base = specifier.startsWith('.')
    ? resolve(dirname(from), specifier)
    : specifier.startsWith('@shared/')
      ? resolve(SHARED_SOURCE, specifier.slice('@shared/'.length))
      : specifier.startsWith('@renderer/')
        ? resolve(RENDERER_SOURCE, specifier.slice('@renderer/'.length))
        : null;
  if (base === null) return packageName(specifier);
  if (/\.tsx?$/.test(base) && existsSync(base)) return base;
  const file = EXTENSIONS.map((extension) => base + extension).find((candidate) => existsSync(candidate));
  return file ?? null;
}

function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return (specifier.startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1)).join('/');
}

/** Each module the entry reaches, with the module that first imported it: the chain to any of them. */
function staticGraph(entry: string): Map<string, string | null> {
  const importedBy = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    for (const specifier of runtimeImports(readFileSync(file, 'utf8'))) {
      const module = resolveModule(file, specifier);
      if (module === null || importedBy.has(module)) continue;
      importedBy.set(module, file);
      queue.push(module);
    }
  }
  return importedBy;
}

function chainTo(module: string, importedBy: Map<string, string | null>): string {
  const chain: string[] = [];
  for (let step: string | null | undefined = module; step; step = importedBy.get(step)) chain.unshift(isAbsolute(step) ? relative(RENDERER_SOURCE, step) : step);
  return chain.join(' → ');
}

describe('startup bundle', () => {
  const importedBy = staticGraph(ENTRY);

  it('holds every view, so none paints a generic fallback first', () => {
    const views = ['PendingChangesView', 'IncomingChangesView', 'FilesView', 'BranchExplorerView', 'SyncView'];

    expect(views.filter((view) => ![...importedBy.keys()].some((module) => module.endsWith(`${view}.tsx`)))).toEqual([]);
  });

  it('leaves the heavy libraries to load on first use', () => {
    const reached = HEAVY_PACKAGES.filter((name) => importedBy.has(name)).map((name) => chainTo(name, importedBy));

    expect(reached).toEqual([]);
  });

  it('reads imports as TypeScript emits them', () => {
    const source = [
      "import type { A } from './a';",
      "import { type B, type C } from './b';",
      "import { D, type E } from './d';",
      "import {\n  F,\n  G,\n} from '../f';",
      "export { H } from './h';",
      "import './styles.css';",
    ].join('\n');

    expect(runtimeImports(source)).toEqual(['./d', '../f', './h', './styles.css']);
    expect(packageName('three/examples/jsm/loaders/GLTFLoader.js')).toBe('three');
    expect(packageName('@pierre/diffs/react')).toBe('@pierre/diffs');
  });
});
