import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';
import { literalsOf, withoutComments } from '@shared/testing/sourceLiterals';

/**
 * `cm` owns its files: the app asks `cm` commands, never reads what `cm` keeps for itself, whose format is `cm`'s to
 * change. Those are a workspace's metadata (`.plastic/`: `plastic.selector`, `plastic.wktree`, `changelists/`...) and
 * the user's config folder (`plasticConfigFolder`, `PLASTIC_HOME`: `client.conf`, `tokens.conf`, `plastic.workspaces`,
 * `*.token`, `<guid>.key`, `globalconfig/`...). This scans the literals of every app source under `src/` for those
 * names, and holds each module allowed to name them (and the first-run import's parser) to exactly the file system
 * functions it may import. `testing/` folders are left out: their fakes play `cm`'s part, as the smoke test's fixture
 * does. The workspace's own rule files (`ignore.conf`...) are the user's, not `cm`'s.
 */

const SRC_DIRECTORY = join(__dirname, '..', '..');

/**
 * Plain-line files at the workspace's root that the user writes, often checked in, and no `cm` command manages: not
 * `cm`'s own, though they are named `.conf` too. `writable.conf` and `readonly.conf` are rules of the same kind, which
 * the renderer shows as config files (`fileFamily`, `syntaxLanguage`).
 */
const WORKSPACE_RULE_FILES = new Set(['ignore.conf', 'cloaked.conf', 'hidden_changes.conf', 'writable.conf', 'readonly.conf']);

interface Allowance {
  why: string;
  /** Exactly what it imports from `node:fs` and `node:fs/promises`; types aside. */
  fileSystem: string[];
  /** False for a module listed for its file system imports alone, which names none of `cm`'s files. */
  names?: false;
}

const ALLOWED: Record<string, Allowance> = {
  'main/plasticConfig/configFolder.ts': { fileSystem: [], why: 'where the official client keeps its config, for the first-run import' },
  'main/settings/importLegacySettings.ts': { fileSystem: ['readFileSync'], why: 'the first-run import, which reads plasticgui.conf and client.conf once' },
  'main/plasticConfig/recentBranchesConf.ts': { fileSystem: [], names: false, why: 'parses the plasticgui.conf text the first-run import reads' },
  'main/watch/classifyChange.ts': { fileSystem: [], why: 'the files cm rewrites in .plastic are refresh signals for the watcher' },
  'main/watch/WorkspaceWatcher.ts': { fileSystem: [], why: 'watches .plastic for rewrites' },
  'main/files/listWorkspacePaths.ts': { fileSystem: ['readdir'], why: 'skips .plastic when listing the workspace’s own files' },
  'main/cm/setupCheck.ts': { fileSystem: [], why: 'tells cm’s “client.conf not found” error, what cm says without a configuration' },
  'main/system/draggedFolder.ts': {
    fileSystem: ['stat'],
    why: 'a .plastic folder tells, while a folder is dragged, that it is a workspace; the drop asks cm getworkspacefrompath',
  },
};

/**
 * What a module reaching the official client's config folder may take from the file system: only ways to read it.
 * `open` isn't one, as its flags can write.
 */
const READ_ONLY_FILE_SYSTEM = new Set(['existsSync', 'readFile', 'readFileSync', 'readdir', 'readdirSync', 'stat', 'statSync', 'lstat', 'lstatSync', 'access', 'accessSync', 'createReadStream']);

/**
 * A `.key` file of the config folder: `cm` names each after a GUID. Any other `*.key` would take a template's
 * `${file.key}` or `${bar.motion?.key}` for one.
 */
const KEY_FILE = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.key$/;
/** A file named in a template, `${server}.token` or `${id}.key`: an extension after a placeholder. */
const FILE_AFTER_PLACEHOLDER = /\}\.(conf|token|key)(?!\w)/;

/**
 * A file or folder `cm` keeps for itself: `.plastic` and the `plastic.*` files in it, the config folder (`plastic4`),
 * its `globalconfig` folder and its `*.conf`, `*.token` and `<guid>.key` files; an extension alone (`.conf`) names no
 * file. `globalconfig` is matched as `cm` writes it, so a `globalConfig` name isn't one; `plastic.exe` is the official
 * client, a merge tool the user may pick.
 */
function isCmFileName(word: string): boolean {
  const name = word.toLowerCase();
  if (WORKSPACE_RULE_FILES.has(name)) return false;
  return (
    name === '.plastic' ||
    name === 'plastic4' ||
    name === '.plastic4' ||
    word === 'globalconfig' ||
    /^plastic\.(?!exe$)\w+$/.test(name) ||
    /^[\w.-]+\.(conf|token)$/.test(name) ||
    KEY_FILE.test(name)
  );
}

/** Whether a literal names one of `cm`'s files, in a path of either form or a regular expression. */
function namesCmFile(literal: string): boolean {
  return FILE_AFTER_PLACEHOLDER.test(literal) || literal.split(/[^\w.-]+/).some(isCmFileName);
}

/** What names `cm`'s files in a module: its literals that do, and the config folder's environment variable. */
function cmFilesNamedIn(code: string): string[] {
  const named = /\bPLASTIC_HOME\b/.test(code) ? ['PLASTIC_HOME'] : [];
  // Most modules can't name one: only those that hold the words are read literal by literal.
  if (!/plastic|globalconfig|\.conf|\.token|\.key/i.test(code)) return named;
  return [...named, ...literalsOf(code).filter(namesCmFile)];
}

const FILE_SYSTEM_MODULE = `['"](?:node:)?fs(?:/promises)?['"]`;

/**
 * What `code` takes from the file system modules, by name. A namespace, default or `require`d import is `*`: it can
 * reach every function. `import type` and `type` names start nothing.
 */
function fileSystemImportsOf(code: string): string[] {
  const names: string[] = [];
  for (const [, clause] of code.matchAll(new RegExp(`\\bimport\\s+([^;]*?)\\s*from\\s*${FILE_SYSTEM_MODULE}`, 'g'))) {
    if (/^type\s/.test(clause!)) continue;
    const named = /^\{([^}]*)\}$/.exec(clause!.trim());
    if (!named) {
      names.push('*');
      continue;
    }
    for (const specifier of named[1]!.split(',').map((part) => part.trim())) {
      if (specifier && !specifier.startsWith('type ')) names.push(specifier.split(/\s+as\s+/)[0]!);
    }
  }
  if (new RegExp(`\\b(require|import)\\s*\\(\\s*${FILE_SYSTEM_MODULE}`).test(code)) names.push('*');
  return names.sort();
}

const relative = (file: string): string => file.slice(SRC_DIRECTORY.length + 1).split(sep).join('/');
const sources = filesUnder(SRC_DIRECTORY, isAppSource)
  .map((file) => ({ file: relative(file), code: withoutComments(readFileSync(file, 'utf8')) }))
  .filter(({ file }) => !file.split('/').includes('testing'));
const filesWhere = (test: (code: string) => boolean): string[] => sources.filter(({ code }) => test(code)).map(({ file }) => file).sort();

describe('namesCmFile', () => {
  it("knows a workspace's metadata, in any path form or a regular expression", () => {
    const names = ['.plastic', '/ws/.plastic/plastic.selector', 'C:\\ws\\.plastic\\changelists', 'plastic.wktree', '${root}/.plastic/x', '^.plastic(?:[\\/]|$)'];
    expect(names.filter(namesCmFile)).toEqual(names);
  });

  it('knows the config folder and its files', () => {
    const names = ['plastic4', '~/.plastic4/client.conf', 'tokens.conf', 'plastic.workspaces', 'plasticgui.conf', 'cloud.server.token', '${server}.token', '${name}.conf'];
    expect(names.filter(namesCmFile)).toEqual(names);
  });

  it("knows the config folder's keys and its globalconfig folder", () => {
    const names = ['15c18e91-96a7-4a76-b933-64524ec5d045.key', '${id}.key', '~/.plastic4/globalconfig', 'C:\\Users\\me\\AppData\\Local\\plastic4\\globalconfig\\x'];
    expect(names.filter(namesCmFile)).toEqual(names);
  });

  it("leaves the workspace's rule files and other names alone", () => {
    expect(['ignore.conf', 'cloaked.conf', 'hidden_changes.conf', '.plasticignore', 'plastic.exe', 'plastic', 'Assets/Plastic/readme.md', 'conf'].filter(namesCmFile)).toEqual([]);
  });

  it('leaves an extension alone, which names no file', () => {
    expect(['.conf', '.token', '.key', '*.conf', 'files ending in .token'].filter(namesCmFile)).toEqual([]);
  });

  it("leaves a template's `.key` reads and a `globalConfig` name alone", () => {
    expect(['file:${file.key}', 'node:${hit.side}:${hit.key}', 'fill-${bar.motion?.key}', '${globalConfig}'].filter(namesCmFile)).toEqual([]);
  });
});

describe('fileSystemImportsOf', () => {
  it('reads named imports, over several lines, from either module', () => {
    expect(fileSystemImportsOf("import {\n  stat,\n  readdir as list,\n} from 'node:fs/promises';\nimport { existsSync } from 'fs';")).toEqual(['existsSync', 'readdir', 'stat']);
  });

  it('counts a namespace, default or required import as everything', () => {
    expect(fileSystemImportsOf("import * as fs from 'node:fs/promises';")).toEqual(['*']);
    expect(fileSystemImportsOf("import fs from 'node:fs';")).toEqual(['*']);
    expect(fileSystemImportsOf("import fs, { stat } from 'node:fs';")).toEqual(['*']);
    expect(fileSystemImportsOf("const fs = require('node:fs');")).toEqual(['*']);
    expect(fileSystemImportsOf("const fs = await import('fs/promises');")).toEqual(['*']);
  });

  it('leaves types out', () => {
    expect(fileSystemImportsOf("import type { Dirent } from 'node:fs';\nimport { type Stats, stat } from 'node:fs/promises';")).toEqual(['stat']);
  });
});

describe("cm's own files", () => {
  it('are named only by the modules allowed to, each for its reason', () => {
    const named = sources.filter(({ file }) => !(file in ALLOWED)).map(({ file, code }) => [file, cmFilesNamedIn(code)] as const);
    const unlisted = Object.fromEntries(named.filter(([, names]) => names.length > 0));
    expect(unlisted).toEqual({});
  });

  it('are still named by every module allowed to, so an entry no longer needed goes', () => {
    const naming = Object.entries(ALLOWED).filter(([, { names }]) => names !== false);
    const namingNone = naming.filter(([file]) => cmFilesNamedIn(sources.find((source) => source.file === file)?.code ?? '').length === 0);
    expect(namingNone.map(([file]) => file)).toEqual([]);
  });

  it('are named only by modules that import from the file system exactly what their reason needs', () => {
    const importsOf = (file: string): string[] => {
      const source = sources.find((candidate) => candidate.file === file);
      return source ? fileSystemImportsOf(source.code) : ['no such module'];
    };
    const imports = Object.fromEntries(Object.keys(ALLOWED).map((file) => [file, importsOf(file)]));
    expect(imports).toEqual(Object.fromEntries(Object.entries(ALLOWED).map(([file, { fileSystem }]) => [file, [...fileSystem].sort()])));
  });
});

describe("the official client's config", () => {
  it('is reached only by the first-run import, wired once at start', () => {
    expect(filesWhere((code) => code.includes('plasticConfigFolder('))).toEqual(['main/plasticConfig/configFolder.ts', 'main/startup/settings.ts']);
    // `legacyMergeTools` maps what the import read; it reads nothing.
    expect(filesWhere((code) => /from '\.\.?\/(\.\.\/)?plasticConfig\//.test(code))).toEqual([
      'main/settings/importLegacySettings.ts',
      'main/settings/legacyMergeTools.ts',
      'main/startup/settings.ts',
    ]);
  });

  it('is only read: every module in plasticConfig/ takes from the file system only ways to read', () => {
    const configModules = sources.filter(({ file }) => file.startsWith('main/plasticConfig/'));
    const writes = configModules.flatMap(({ file, code }) => fileSystemImportsOf(code).filter((name) => !READ_ONLY_FILE_SYSTEM.has(name)).map((name) => `${file}: ${name}`));
    expect(configModules.length).toBeGreaterThan(0);
    expect(writes).toEqual([]);
  });
});
