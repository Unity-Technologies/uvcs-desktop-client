import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/**
 * `cm` owns its files: the app asks `cm` commands, never reads what `cm` keeps for itself, whose format is `cm`'s to
 * change. Those are a workspace's metadata (`.plastic/`: `plastic.selector`, `plastic.wktree`, `changelists/`...) and
 * the user's config folder (`plasticConfigFolder`: `client.conf`, `tokens.conf`, `plastic.workspaces`, `*.token`...).
 * This scans the app's sources for the string, template and regular expression literals that name them, and holds
 * each module that does to what it may do with them. The workspace's own rule files (`ignore.conf`...) are the user's.
 */

const SRC_DIRECTORY = join(__dirname, '..', '..');
const SCANNED_TIERS = ['main', 'renderer', 'shared'];

/**
 * Plain-line files at the workspace's root that the user writes, often checked in, and `cm` has no command to manage:
 * not `cm`'s own, though they are named `.conf` too.
 */
const WORKSPACE_RULE_FILES = new Set(['ignore.conf', 'cloaked.conf', 'hidden_changes.conf', 'writable.conf', 'readonly.conf']);

/** What a module allowed to name `cm`'s files may read of them. */
type Reads = 'nothing' | 'the workspace rule files' | 'the config folder, once';

const ALLOWED: Record<string, { reads: Reads; why: string }> = {
  'main/plasticConfig/configFolder.ts': { reads: 'nothing', why: 'where the official client keeps its config, for the first-run import' },
  'main/settings/importLegacySettings.ts': { reads: 'the config folder, once', why: 'the first-run import reads plasticgui.conf once' },
  'main/watch/classifyChange.ts': { reads: 'nothing', why: 'the files cm rewrites in .plastic are refresh signals for the watcher' },
  'main/watch/WorkspaceWatcher.ts': { reads: 'the workspace rule files', why: 'watches .plastic for rewrites; reads ignore.conf to skip folders' },
  'main/files/listWorkspacePaths.ts': { reads: 'nothing', why: 'skips .plastic when listing the workspace’s own files' },
  'main/system/draggedFolder.ts': {
    reads: 'nothing',
    why: 'a .plastic folder tells, while a folder is dragged, that it is a workspace; the drop asks cm getworkspacefrompath',
  },
};

/** The modules that reach the official client's config folder, the first-run import's. */
const LEGACY_READERS = ['main/plasticConfig/configFolder.ts', 'main/plasticConfig/recentBranchesConf.ts', 'main/settings/importLegacySettings.ts'];

const FILE_READS = /\b(readFile|readFileSync|createReadStream|open|openSync|readSync)\b/;
const FILE_WRITES = /\b(writeFile|writeFileSync|appendFile|appendFileSync|rename|renameSync|mkdir|mkdirSync|rm|rmSync|unlink|unlinkSync|copyFile|copyFileSync|createWriteStream)\b/;

/** A keyword after which `/` starts a regular expression, not a division. */
const KEYWORDS_BEFORE_EXPRESSION = new Set(['return', 'typeof', 'case', 'in', 'of', 'void', 'delete', 'throw', 'yield', 'await', 'else', 'do']);

/**
 * The text of every string, template and regular expression literal in `source`, escapes undone; comments left out,
 * as they may name `cm`'s files to explain why the app doesn't read them. A template gives its pieces between the
 * `${...}`, and the literals inside those too.
 */
function literalsOf(source: string): string[] {
  const literals: string[] = [];
  const templateDepths: number[] = [];
  let depth = 0;
  let previous = '';
  let index = 0;
  const readTemplate = (from: number): number => {
    let end = from;
    while (end < source.length && source[end] !== '`' && !(source[end] === '$' && source[end + 1] === '{')) end += source[end] === '\\' ? 2 : 1;
    literals.push(unescaped(source.slice(from, end)));
    if (source[end] === '`') return end + 1;
    templateDepths.push(depth);
    return end + 2;
  };
  while (index < source.length) {
    const char = source[index]!;
    const next = source[index + 1];
    if (char === '/' && next === '/') {
      index = source.indexOf('\n', index) === -1 ? source.length : source.indexOf('\n', index);
    } else if (char === '/' && next === '*') {
      index = source.indexOf('*/', index + 2) === -1 ? source.length : source.indexOf('*/', index + 2) + 2;
    } else if (char === "'" || char === '"') {
      const end = quoteEnd(source, index + 1, char);
      literals.push(unescaped(source.slice(index + 1, end)));
      index = end + 1;
      previous = 'literal';
    } else if (char === '`') {
      index = readTemplate(index + 1);
      previous = 'literal';
    } else if (char === '}' && templateDepths.at(-1) === depth) {
      templateDepths.pop();
      index = readTemplate(index + 1);
      previous = 'literal';
    } else if (char === '/' && startsExpression(previous)) {
      const end = regexEnd(source, index + 1);
      literals.push(unescaped(source.slice(index + 1, end)));
      index = end + 1;
      previous = 'literal';
    } else if (/[\w$]/.test(char)) {
      const word = /^[\w$]+/.exec(source.slice(index))![0];
      index += word.length;
      previous = word;
    } else {
      if (char === '{') depth++;
      if (char === '}') depth--;
      if (!/\s/.test(char)) previous = char;
      index++;
    }
  }
  return literals;
}

function quoteEnd(source: string, from: number, quote: string): number {
  let index = from;
  while (index < source.length && source[index] !== quote && source[index] !== '\n') index += source[index] === '\\' ? 2 : 1;
  return index;
}

function regexEnd(source: string, from: number): number {
  let inClass = false;
  let index = from;
  for (; index < source.length && source[index] !== '\n'; index++) {
    const char = source[index];
    if (char === '\\') index++;
    else if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) break;
  }
  return index;
}

/** After a value (a name, a literal, `)` or `]`) a `/` divides; anywhere else it starts a regular expression. */
function startsExpression(previous: string): boolean {
  if (/^[\w$]+$/.test(previous)) return KEYWORDS_BEFORE_EXPRESSION.has(previous);
  return previous !== 'literal' && previous !== ')' && previous !== ']';
}

/** `\\` as `\`, `\.` as `.`: what the literal names, near enough to tell a file name. */
function unescaped(text: string): string {
  return text.replace(/\\(.)/g, '$1');
}

/** Whether a literal names, in any path form, one of `cm`'s own files or folders. */
function namesCmFile(literal: string): boolean {
  return literal.split(/[\\/]/).some(isCmFileName);
}

/**
 * A file or folder `cm` keeps for itself: `.plastic` and the `plastic.*` files in it, the config folder (`plastic4`) and
 * its `*.conf` and `*.token` files. `plastic.exe` is the official client, a merge tool the user may pick, not one.
 */
function isCmFileName(segment: string): boolean {
  const name = segment.toLowerCase();
  if (WORKSPACE_RULE_FILES.has(name)) return false;
  return name === '.plastic' || name === 'plastic4' || name === '.plastic4' || /^plastic\.(?!exe$)\w+$/.test(name) || /^[\w.-]+\.(conf|token)$/.test(name);
}

const relative = (file: string): string => file.slice(SRC_DIRECTORY.length + 1).split(sep).join('/');
const sources = SCANNED_TIERS.flatMap((tier) => filesUnder(join(SRC_DIRECTORY, tier), isAppSource)).map((file) => {
  const text = readFileSync(file, 'utf8');
  return { file: relative(file), text, literals: literalsOf(text) };
});
const sourceOf = (file: string) => sources.find((source) => source.file === file)!;
const filesWhere = (test: (source: (typeof sources)[number]) => boolean): string[] => sources.filter(test).map(({ file }) => file).sort();

function importsOf(file: string): string {
  return sourceOf(file)
    .text.split('\n')
    .filter((line) => line.startsWith('import '))
    .join('\n');
}

/** Each call of a file-reading function in `source`, with its arguments. */
function readCalls(source: string): string[] {
  const calls: string[] = [];
  const call = new RegExp(`${FILE_READS.source}\\s*\\(`, 'g');
  for (let match = call.exec(source); match; match = call.exec(source)) {
    let depth = 0;
    let end = match.index + match[0].length - 1;
    for (; end < source.length; end++) {
      if (source[end] === '(') depth++;
      if (source[end] === ')' && --depth === 0) break;
    }
    calls.push(source.slice(match.index, end + 1));
  }
  return calls;
}

describe('literalsOf', () => {
  it('reads strings, escapes undone, and leaves comments out', () => {
    const source = "// '.plastic' here is a comment\nconst a = 'it\\'s'; /* \"no\" */ const b = \"C:\\\\ws\";";
    expect(literalsOf(source)).toEqual(["it's", 'C:\\ws']);
  });

  it('reads a template’s pieces and the literals inside its expressions', () => {
    expect(literalsOf("`${root}/.plastic/${ok ? 'plastic.selector' : `x${1}`}`")).toEqual(['', '/.plastic/', 'plastic.selector', 'x', '', '']);
  });

  it('reads regular expressions, and tells them from divisions', () => {
    expect(literalsOf("const re = /\\.plastic\\//; const half = a / b / 'c'; return /[/]x/.test(s);")).toEqual(['.plastic/', 'c', '[/]x']);
  });
});

describe('namesCmFile', () => {
  it("knows a workspace's metadata, in any path form", () => {
    expect(['.plastic', '/ws/.plastic/plastic.selector', 'C:\\ws\\.plastic\\changelists', 'plastic.wktree', 'plastic.workspace'].filter(namesCmFile)).toHaveLength(5);
  });

  it('knows the config folder and its files', () => {
    expect(['plastic4', '~/.plastic4/client.conf', 'tokens.conf', 'plastic.workspaces', 'plasticgui.conf', 'cloud.server.token'].filter(namesCmFile)).toHaveLength(6);
  });

  it("leaves the workspace's rule files and other names alone", () => {
    expect(['ignore.conf', 'cloaked.conf', 'hidden_changes.conf', '.plasticignore', 'plastic.exe', 'plastic', 'Assets/Plastic/readme.md', 'conf'].filter(namesCmFile)).toEqual([]);
  });
});

describe("cm's own files", () => {
  it('are named only by the modules allowed to, each for its reason', () => {
    expect(filesWhere(({ literals }) => literals.some(namesCmFile))).toEqual(Object.keys(ALLOWED).sort());
  });

  it('are never read by the modules that only watch, skip or look for them', () => {
    const readers = Object.entries(ALLOWED).filter(([file, { reads }]) => reads === 'nothing' && FILE_READS.test(importsOf(file)));
    expect(readers.map(([file]) => file)).toEqual([]);
  });

  it('are never read by the modules that read the workspace rule files: each read names a rule file', () => {
    const ruleFileReaders = Object.keys(ALLOWED).filter((file) => ALLOWED[file]!.reads === 'the workspace rule files');
    const otherReads = ruleFileReaders.flatMap((file) => readCalls(sourceOf(file).text).filter((call) => !literalsOf(call).some((literal) => WORKSPACE_RULE_FILES.has(literal))));
    expect(otherReads).toEqual([]);
  });

  it('in the config folder are read only by the first-run import', () => {
    const configReaders = Object.keys(ALLOWED).filter((file) => ALLOWED[file]!.reads === 'the config folder, once');
    expect(configReaders.filter((file) => !LEGACY_READERS.includes(file))).toEqual([]);
  });
});

describe('the workspace rule files', () => {
  it('are read or written in main only by the watcher (ignore.conf) and the rules the user adds (filterRuleFile)', () => {
    const naming = filesWhere(({ file, literals }) => file.startsWith('main/') && literals.some((literal) => WORKSPACE_RULE_FILES.has(literal)));
    expect(naming).toEqual(['main/watch/WorkspaceWatcher.ts', 'main/workspace/filterRuleFile.ts']);
  });
});

describe("the official client's config", () => {
  it('is reached only by the first-run import, wired once at start', () => {
    expect(filesWhere(({ text }) => text.includes('plasticConfigFolder('))).toEqual(['main/plasticConfig/configFolder.ts', 'main/startup/settings.ts']);
    expect(filesWhere(({ text }) => /from '\.\.?\/(\.\.\/)?plasticConfig\//.test(text))).toEqual(['main/settings/importLegacySettings.ts', 'main/startup/settings.ts']);
  });

  it('is only read: the modules that reach it import no way to write a file', () => {
    expect(LEGACY_READERS.filter((file) => FILE_WRITES.test(importsOf(file)))).toEqual([]);
  });
});
