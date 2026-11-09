import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import './testing/fakeWindow';
import { beforeAll, describe, expect, it } from 'vitest';
import { VIEWS } from './app/navigation/viewRegistry';

/**
 * What the window loads before its first frame: every module `main.tsx` reaches through static imports, every view
 * and page among them (`viewRegistry`, `pageRegistry`), so each paints its own layout at once (ARCHITECTURE.md "One
 * layout from the first frame"). The heavy libraries stay out of it, each loaded on first use behind a lazy boundary
 * at the leaf that uses it (`FileDiffViewer`, `AnnotationPane`, `FileConflictPanel`, `LoadedFileDiff`'s viewers, a
 * comment's `CodeBlock`, and `CommentField`'s editor): one static import of them from a view, even of a helper, would
 * put megabytes in front of every start.
 */
const RENDERER_SOURCE = __dirname;
const SHARED_SOURCE = resolve(__dirname, '../../shared');
const ENTRY = resolve(RENDERER_SOURCE, 'main.tsx');

/**
 * Pierre's diff viewer, Shiki's grammars under it (reached directly too), three.js, for 3D models, and the comment
 * editor's CodeMirror (`LiveCommentEditor`) with what turns a paste's HTML into Markdown: megabytes the first frame
 * never needs. A new heavy library joins them, and loads behind a lazy boundary at the leaf that uses it.
 */
const HEAVY_PACKAGES = ['@pierre/diffs', 'shiki', 'three', 'hast-util-from-html', 'hast-util-to-mdast', 'mdast-util-to-markdown'];
const HEAVY_SCOPES = ['@shikijs/', '@codemirror/', '@lezer/'];

/** What a module may import that isn't code: styles, and assets Vite turns into a URL or a string (`?url`, `?raw`). */
const ASSET = /\.(css|svg|png|jpe?g|gif|webp|json|wasm|txt)$|\?[a-z]+$/;

const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

/**
 * The modules a source imports at run time: `import type` and clauses of types only are left out, as TypeScript drops
 * them. A clause may run across lines, and so may swallow a statement before the next `from`: that only ever reads a
 * type import as a runtime one, so the test errs on the side of reporting.
 */
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
  if (ASSET.test(specifier)) return null;
  if (/\.tsx?$/.test(base) && existsSync(base)) return base;
  const file = EXTENSIONS.map((extension) => base + extension).find((candidate) => existsSync(candidate));
  // A module not found would hide everything it imports: say so rather than pass.
  if (file === undefined) throw new Error(`Cannot resolve ${specifier} from ${relative(RENDERER_SOURCE, from)}`);
  return file;
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
  let importedBy = new Map<string, string | null>();
  beforeAll(() => {
    importedBy = staticGraph(ENTRY);
  });

  it('holds every view, so each paints its own layout at once, never a fallback it then replaces', () => {
    const modules = [...importedBy.keys()];
    const missing = VIEWS.filter(({ component }) => !modules.some((module) => basename(module) === `${component.name}.tsx`)).map((view) => view.id);

    expect(missing).toEqual([]);
  });

  it('holds every page, which the page registry imports, none lazily', () => {
    const registry = readFileSync(resolve(RENDERER_SOURCE, 'app/navigation/pageRegistry.tsx'), 'utf8');

    expect(registry).not.toMatch(/\b(lazy|lazyComponent)\s*\(/);
    expect([...importedBy.keys()].some((module) => module.endsWith('pageRegistry.tsx'))).toBe(true);
  });

  it('leaves the heavy libraries to load on first use', () => {
    const heavy = [...importedBy.keys()].filter((module) => HEAVY_PACKAGES.includes(module) || HEAVY_SCOPES.some((scope) => module.startsWith(scope)));

    expect(heavy.map((module) => chainTo(module, importedBy))).toEqual([]);
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
    expect(packageName('@shikijs/langs/typescript')).toBe('@shikijs/langs');
  });
});
