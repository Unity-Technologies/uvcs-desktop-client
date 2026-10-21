import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';
import { literalsOf, withoutComments } from '@shared/testing/sourceLiterals';

/**
 * `cm` owns its files: the app asks `cm` commands, never reads what `cm` keeps for itself, whose format is `cm`'s to
 * change. Those are a workspace's metadata (`.plastic/`: `plastic.selector`, `plastic.wktree`, `changelists/`...) and
 * the user's config folder (`plasticConfigFolder`, `PLASTIC_HOME`: `client.conf`, `tokens.conf`, `plastic.workspaces`,
 * `*.token`, `<guid>.key`, `globalconfig/`...). This scans the literals of the app's sources for those names, and holds
 * each module that names them to the file system functions it may import. `testing/` folders are left out: their fakes play `cm`'s part, as the
 * smoke test's fixture does. The workspace's own rule files (`ignore.conf`...) are the user's, not `cm`'s.
 */

const SRC_DIRECTORY = join(__dirname, '..', '..');
const SCANNED_TIERS = ['main', 'renderer', 'shared'];

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
  /** Every read it makes names one of these files. */
  readsOnly?: Set<string>;
}

const ALLOWED: Record<string, Allowance> = {
  'main/plasticConfig/configFolder.ts': { fileSystem: [], why: 'where the official client keeps its config, for the first-run import' },
  'main/settings/importLegacySettings.ts': { fileSystem: ['readFileSync'], why: 'the first-run import, which reads plasticgui.conf once' },
  'main/watch/classifyChange.ts': { fileSystem: [], why: 'the files cm rewrites in .plastic are refresh signals for the watcher' },
  'main/watch/WorkspaceWatcher.ts': { fileSystem: [], why: 'watches .plastic for rewrites' },
  'main/files/listWorkspacePaths.ts': { fileSystem: ['readdir'], why: 'skips .plastic when listing the workspace’s own files' },
  'main/cm/setupCheck.ts': { fileSystem: [], why: 'tells cm’s “client.conf not found” error, what cm says without a configuration' },
  'main/system/draggedFolder.ts': {
    fileSystem: ['stat'],
    why: 'a .plastic folder tells, while a folder is dragged, that it is a workspace; the drop asks cm getworkspacefrompath',
  },
};

/** The modules that reach the official client's config folder: the first-run import's. */
const LEGACY_READERS = ['main/plasticConfig/configFolder.ts', 'main/plasticConfig/recentBranchesConf.ts', 'main/settings/importLegacySettings.ts'];

const FILE_WRITES = new Set(
  'writeFile writeFileSync appendFile appendFileSync rename renameSync mkdir mkdirSync rm rmSync unlink unlinkSync copyFile copyFileSync createWriteStream'.split(' '),
);

/**
 * A `.key` file of the config folder: `cm` names each after a GUID, `<guid>.key`, or `${id}.key` in a template. Any
 * other `*.key` would take a template's `${file.key}` or `${bar.motion?.key}` for one.
 */
const KEY_FILE = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.key$/;
const KEY_FILE_AFTER_PLACEHOLDER = /\}\.key(?!\w)/;

/**
 * A file or folder `cm` keeps for itself: `.plastic` and the `plastic.*` files in it, the config folder (`plastic4`),
 * its `globalconfig` folder and its `*.conf`, `*.token` and `<guid>.key` files. `globalconfig` is matched as `cm`
 * writes it, so a `globalConfig` name isn't one; `plastic.exe` is the official client, a merge tool the user may pick.
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
    /^[\w.-]*\.(conf|token)$/.test(name) ||
    KEY_FILE.test(name)
  );
}

/** Whether a literal names one of `cm`'s files, in a path of either form or a regular expression. */
function namesCmFile(literal: string): boolean {
  return KEY_FILE_AFTER_PLACEHOLDER.test(literal) || literal.split(/[^\w.-]+/).some(isCmFileName);
}

/** Whether a module names `cm`'s files: in a literal, or the config folder's environment variable anywhere. */
function namesCmFiles(code: string): boolean {
  if (/\bPLASTIC_HOME\b/.test(code)) return true;
  // Most modules can't name one: only those that hold the words are read literal by literal.
  return /plastic|globalconfig|\.conf|\.token|\.key/i.test(code) && literalsOf(code).some(namesCmFile);
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

/** Each call of one of `functions` in `code`, with its arguments. */
function callsOf(code: string, functions: string[]): string[] {
  const calls: string[] = [];
  for (const match of code.matchAll(new RegExp(`\\b(${functions.join('|')})\\s*\\(`, 'g'))) {
    let depth = 0;
    let end = match.index + match[0].length - 1;
    for (; end < code.length; end++) {
      if (code[end] === '(') depth++;
      if (code[end] === ')' && --depth === 0) break;
    }
    calls.push(code.slice(match.index, end + 1));
  }
  return calls;
}

const relative = (file: string): string => file.slice(SRC_DIRECTORY.length + 1).split(sep).join('/');
const sources = SCANNED_TIERS.flatMap((tier) => filesUnder(join(SRC_DIRECTORY, tier), isAppSource))
  .map((file) => ({ file: relative(file), code: withoutComments(readFileSync(file, 'utf8')) }))
  .filter(({ file }) => !file.split('/').includes('testing'));
const codeOf = (file: string): string => sources.find((source) => source.file === file)!.code;
const filesWhere = (test: (code: string) => boolean): string[] => sources.filter(({ code }) => test(code)).map(({ file }) => file).sort();

describe('namesCmFile', () => {
  it("knows a workspace's metadata, in any path form or a regular expression", () => {
    const names = ['.plastic', '/ws/.plastic/plastic.selector', 'C:\\ws\\.plastic\\changelists', 'plastic.wktree', '${root}/.plastic/x', '^.plastic(?:[\\/]|$)'];
    expect(names.filter(namesCmFile)).toEqual(names);
  });

  it('knows the config folder and its files', () => {
    const names = ['plastic4', '~/.plastic4/client.conf', 'tokens.conf', 'plastic.workspaces', 'plasticgui.conf', 'cloud.server.token', '${server}.token'];
    expect(names.filter(namesCmFile)).toEqual(names);
  });

  it("knows the config folder's keys and its globalconfig folder", () => {
    const names = ['15c18e91-96a7-4a76-b933-64524ec5d045.key', '${id}.key', '~/.plastic4/globalconfig', 'C:\\Users\\me\\AppData\\Local\\plastic4\\globalconfig\\x'];
    expect(names.filter(namesCmFile)).toEqual(names);
  });

  it("leaves the workspace's rule files and other names alone", () => {
    expect(['ignore.conf', 'cloaked.conf', 'hidden_changes.conf', '.plasticignore', 'plastic.exe', 'plastic', 'Assets/Plastic/readme.md', 'conf'].filter(namesCmFile)).toEqual([]);
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
    expect(filesWhere(namesCmFiles)).toEqual(Object.keys(ALLOWED).sort());
  });

  it('are named only by modules that import from the file system just what their reason needs', () => {
    const imports = Object.fromEntries(Object.keys(ALLOWED).map((file) => [file, fileSystemImportsOf(codeOf(file))]));
    expect(imports).toEqual(Object.fromEntries(Object.entries(ALLOWED).map(([file, { fileSystem }]) => [file, [...fileSystem].sort()])));
  });

  it('are never read by a module allowed to read only some files: each read names one of them', () => {
    const otherReads = Object.entries(ALLOWED).flatMap(([file, { fileSystem, readsOnly }]) =>
      readsOnly && fileSystem.length > 0 ? callsOf(codeOf(file), fileSystem).filter((call) => !literalsOf(call).some((literal) => readsOnly.has(literal))) : [],
    );
    expect(otherReads).toEqual([]);
  });
});

describe("the official client's config", () => {
  it('is reached only by the first-run import, wired once at start', () => {
    expect(filesWhere((code) => code.includes('plasticConfigFolder('))).toEqual(['main/plasticConfig/configFolder.ts', 'main/startup/settings.ts']);
    expect(filesWhere((code) => /from '\.\.?\/(\.\.\/)?plasticConfig\//.test(code))).toEqual(['main/settings/importLegacySettings.ts', 'main/startup/settings.ts']);
  });

  it('is only read: the modules that reach it import no way to write a file', () => {
    const writers = LEGACY_READERS.filter((file) => fileSystemImportsOf(codeOf(file)).some((name) => name === '*' || FILE_WRITES.has(name)));
    expect(writers).toEqual([]);
  });
});
