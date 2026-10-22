import { AUTO_MERGE_TOOL, SAME_AS_OTHER_FILES, SEMANTIC_TOOL_ID, type CustomMergeTool, type MergeToolRule } from '@shared/domain/mergeTools';
import type { AppSettings } from '@shared/domain/settings';
import type { LegacyMergeToolEntry } from '../plasticConfig/clientConfMergeTools';
import { UVCS_TOOL_ID } from '../merge/mergeTools/knownTools';

/** The merge tool settings the official client's entries become. */
export type ImportedMergeToolSettings = Pick<AppSettings, 'mergeTool' | 'mergeToolRules' | 'unityMergeTool' | 'customMergeTools'>;

/**
 * What a command line of the official client opens: one of the app's own tools, a program of the user's, Smart Merge
 * (Unity's `UnityYAMLMerge`, which the app runs by itself on Unity assets), or nothing the app opens (a binary merge,
 * a command it can't read).
 */
type LegacyTool = { kind: 'tool'; toolId: string } | { kind: 'custom'; tool: Omit<CustomMergeTool, 'id'> } | { kind: 'smartMerge' } | { kind: 'none' };

/**
 * The official client's merge tools as the app's settings: each entry for some files becomes a rule, the one for
 * every text file the tool for every other file (only while the user's is still Automatic), and the tool chained
 * after Smart Merge where Unity assets open. Entries for binary files are left out (the app keeps one version of a
 * binary), as are regular expressions, and anything the official client would never reach (after its entry for every
 * file). The client sends C#, Visual Basic and Java to Semantic Merge when its own merge tool takes every file:
 * that becomes a rule too, while every other file still opens in that tool here (not in one the user picked).
 */
export function legacyMergeToolSettings(entries: LegacyMergeToolEntry[], current: ImportedMergeToolSettings): ImportedMergeToolSettings {
  const customTools: CustomMergeTool[] = [...current.customMergeTools];
  const toolIdOf = (tool: LegacyTool): string | null => {
    if (tool.kind === 'tool') return tool.toolId;
    if (tool.kind !== 'custom') return null;
    const same = customTools.find((custom) => custom.executable === tool.tool.executable && custom.args.join('\0') === tool.tool.args.join('\0'));
    if (same) return same.id;
    const id = `custom:imported:${customTools.length + 1}`;
    customTools.push({ id, ...tool.tool });
    return id;
  };

  const rules: MergeToolRule[] = [];
  let everyOtherFile: string | null = null;
  let afterSmartMerge: string | null | undefined;
  for (const entry of entries) {
    if (entry.fileType === 'binary') continue;
    const [first, ...chained] = entry.commands.map(legacyTool);
    if (first?.kind === 'smartMerge') {
      // The tool chained after it opens what it can't merge.
      afterSmartMerge ??= chained[0] ? toolIdOf(chained[0]) : null;
      continue;
    }
    const last = entry.commands.length > 0 ? legacyTool(entry.commands.at(-1)!) : undefined;
    const toolId = last ? toolIdOf(last) : null;
    // The client goes no further for a text file, even when the app can't read its tool for every one.
    if (entry.patterns.includes('*')) {
      everyOtherFile = toolId;
      break;
    }
    if (!toolId) continue;
    const patterns = entry.patterns.filter((pattern) => !isRegularExpression(pattern));
    if (patterns.length > 0) rules.push({ id: `imported:${rules.length + 1}`, patterns, toolId });
  }

  const mergeTool = current.mergeTool === AUTO_MERGE_TOOL && everyOtherFile && everyOtherFile !== UVCS_TOOL_ID ? everyOtherFile : current.mergeTool;
  const defaultToolId = mergeTool === AUTO_MERGE_TOOL ? UVCS_TOOL_ID : mergeTool;
  if (sendsCodeToSemanticMerge(mergeTool)) rules.push(...semanticRule(rules));

  return {
    mergeTool,
    mergeToolRules: withoutRedundantRules(rules, defaultToolId),
    unityMergeTool: afterSmartMerge && afterSmartMerge !== defaultToolId ? afterSmartMerge : SAME_AS_OTHER_FILES,
    customMergeTools: customTools,
  };
}

/**
 * Whether C#, Visual Basic and Java go to Semantic Merge, as the official client sends them: only while every other
 * file opens in the UVCS merge tool (Automatic, or picked by name). A user who picked their own tool keeps C# there.
 */
export function sendsCodeToSemanticMerge(mergeTool: string): boolean {
  return mergeTool === AUTO_MERGE_TOOL || mergeTool === UVCS_TOOL_ID;
}

/** C#, Visual Basic and Java in Semantic Merge, but those the rules before already send elsewhere. */
function semanticRule(rules: MergeToolRule[]): MergeToolRule[] {
  const named = new Set(rules.flatMap((rule) => rule.patterns.map((pattern) => pattern.toLowerCase())));
  const patterns = ['.cs', '.vb', '.java'].filter((pattern) => !named.has(pattern));
  if (patterns.length === 0 || rules.some((rule) => rule.toolId === SEMANTIC_TOOL_ID)) return [];
  return [{ id: 'imported:semantic', patterns, toolId: SEMANTIC_TOOL_ID }];
}

/**
 * Rules that change nothing: their tool is every other file's, and no later rule could take their files (all of them
 * extensions, none in common). The official client sets `.meta` files to its own merge tool, which is every other
 * file's anyway.
 */
function withoutRedundantRules(rules: MergeToolRule[], defaultToolId: string): MergeToolRule[] {
  return rules.filter((rule, index) => {
    if (rule.toolId !== defaultToolId) return true;
    const later = rules.slice(index + 1).flatMap((other) => other.patterns);
    return ![...rule.patterns, ...later].every(isExtension) || rule.patterns.some((pattern) => later.some((other) => sameEnding(pattern, other)));
  });
}

/** `.gz` and `.tar.gz` can name one file: one ends the other. */
function sameEnding(extension: string, other: string): boolean {
  const [a, b] = [extension.toLowerCase(), other.toLowerCase()];
  return a.endsWith(b) || b.endsWith(a);
}

function isExtension(pattern: string): boolean {
  return /^\.[^*?/\\]+$/.test(pattern);
}

/** The official client reads a pattern as a regular expression when it looks like one. */
function isRegularExpression(pattern: string): boolean {
  return pattern.startsWith('^') || pattern.endsWith('$') || pattern.includes('|');
}

/** The official client's own programs, by name: the Desktop GUI, which takes the tool as its first argument, and the tools it once shipped apart. */
const UVCS_GUI_PROGRAMS = new Set(['plastic', 'plasticgui', 'macplasticx', 'linplasticx']);
const UVCS_GUI_COMMANDS: Record<string, string | null> = { xmerge: UVCS_TOOL_ID, semanticmerge: SEMANTIC_TOOL_ID, binmerge: null };
const UVCS_STANDALONE_TOOLS: Record<string, string | null> = {
  mergetool: UVCS_TOOL_ID,
  macmergetool: UVCS_TOOL_ID,
  gtkmergetool: UVCS_TOOL_ID,
  semanticmergetool: SEMANTIC_TOOL_ID,
  binmergetool: null,
};

/** Programs the app knows as its own tools (`KNOWN_TOOLS`), by the names they're run with: the app's arguments for them, which it tests, are used. */
export const KNOWN_PROGRAMS: Record<string, string> = {
  code: 'vscode',
  'code-insiders': 'vscodeInsiders',
  cursor: 'cursor',
  windsurf: 'windsurf',
  rider: 'rider',
  rider64: 'rider',
  idea: 'intellij',
  idea64: 'intellij',
  webstorm: 'webstorm',
  webstorm64: 'webstorm',
  pycharm: 'pycharm',
  pycharm64: 'pycharm',
  clion: 'clion',
  clion64: 'clion',
  goland: 'goland',
  goland64: 'goland',
  smerge: 'smerge',
  sublime_merge: 'smerge',
  kdiff3: 'kdiff3',
  bcomp: 'bcompare',
  bcompare: 'bcompare',
  winmergeu: 'winmerge',
  meld: 'meld',
  p4merge: 'p4merge',
  opendiff: 'opendiff',
  filemerge: 'opendiff',
};

function legacyTool(command: string): LegacyTool {
  const words = commandWords(command);
  const [program, ...args] = /^\/(no)?window$/i.test(words[0] ?? '') ? words.slice(1) : words;
  if (!program) return { kind: 'none' };
  const name = programName(program);
  if (name === 'unityyamlmerge') return { kind: 'smartMerge' };
  if (isOfficialClientScript(program)) return { kind: 'none' };
  if (UVCS_GUI_PROGRAMS.has(name)) return toolOrNone(UVCS_GUI_COMMANDS[args[0]?.toLowerCase() ?? '']);
  if (Object.hasOwn(UVCS_STANDALONE_TOOLS, name)) return toolOrNone(UVCS_STANDALONE_TOOLS[name]);
  if (Object.hasOwn(KNOWN_PROGRAMS, name)) return { kind: 'tool', toolId: KNOWN_PROGRAMS[name]! };
  const appArgs = withAppPlaceholders(args);
  if (!appArgs.some((arg) => arg.includes('{result}'))) return { kind: 'none' };
  return { kind: 'custom', tool: { name: programName(program, false), executable: program, args: appArgs } };
}

/**
 * The official client's own scripts (its `diffscripts` folder: Word documents merged through Word), for binary files no
 * tool opens in the app.
 */
function isOfficialClientScript(program: string): boolean {
  return program.split(/[\\/]/).some((folder) => folder.toLowerCase() === 'diffscripts');
}

function toolOrNone(toolId: string | null | undefined): LegacyTool {
  return toolId ? { kind: 'tool', toolId } : { kind: 'none' };
}

/** `C:\Tools\KDiff3.exe` → `kdiff3`; with `lowercase` false, `KDiff3`. */
function programName(program: string, lowercase = true): string {
  const name = program.split(/[\\/]/).pop()!.replace(/\.(exe|cmd|bat|sh)$/i, '');
  return lowercase ? name.toLowerCase() : name;
}

/**
 * The words of a command line as the official client writes them: spaces between words, quotes around a word with
 * spaces (or around a value, `-b="@basefile"`), dropped. Backslashes are Windows' folder separators, not escapes, and a
 * single quote opens a quote only at a word's start (`/home/o'neil/tool` is one word).
 */
function commandWords(command: string): string[] {
  const words: string[] = [];
  let word = '';
  let started = false;
  let quote: string | null = null;
  for (const char of command) {
    if (quote) {
      if (char === quote) quote = null;
      else word += char;
    } else if (char === '"' || (char === "'" && !started)) {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) words.push(word);
      word = '';
      started = false;
    } else {
      word += char;
      started = true;
    }
  }
  if (started) words.push(word);
  return words;
}

/** The official client's merge variables the app fills too, as the app's placeholders. */
const PLACEHOLDERS: Record<string, string> = {
  basefile: '{base}',
  sourcefile: '{incoming}',
  destinationfile: '{yours}',
  output: '{result}',
  basesymbolic: '{baseName}',
  sourcesymbolic: '{incomingName}',
  destinationsymbolic: '{yoursName}',
};
/** Its variables the app has no value for (encodings, the comparison method, progress, hashes...). */
const UNFILLED = ['filetype', 'comparationmethod', 'fileencoding', 'resultencoding', 'mergetype', 'progress', 'extrainfofile', 'basehash', 'sourcehash', 'destinationhash'];
const VARIABLE = new RegExp(`@(${[...Object.keys(PLACEHOLDERS), ...UNFILLED].sort((a, b) => b.length - a.length).join('|')})`, 'g');

/**
 * The arguments in the app's placeholders. One holding a variable the app can't fill is dropped, as an option left empty
 * could mislead the tool, and so is the switch before it when the variable was the whole argument (`-e @fileencoding`).
 */
function withAppPlaceholders(args: readonly string[]): string[] {
  const converted: string[] = [];
  for (const arg of args) {
    let unfilled = false;
    const withPlaceholders = arg.replace(VARIABLE, (_variable, name: string) => {
      if (PLACEHOLDERS[name]) return PLACEHOLDERS[name];
      unfilled = true;
      return '';
    });
    if (!unfilled) converted.push(withPlaceholders);
    else if (/^@\w+$/.test(arg) && isSwitch(converted.at(-1))) converted.pop();
  }
  return converted;
}

/**
 * `-e`, `--encoding`, `/E`: an option whose value comes as the next argument. A guess the command line can't settle: a
 * flag that takes no value (`-a @mergetype`) looks the same, and is dropped with the variable after it.
 */
function isSwitch(arg: string | undefined): boolean {
  return arg !== undefined && /^(-{1,2}[^=:\s]+|\/[^/\\=:\s]+)$/.test(arg);
}
