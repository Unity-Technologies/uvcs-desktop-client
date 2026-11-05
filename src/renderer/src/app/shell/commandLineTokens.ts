/**
 * What each part of a logged command line is, so the command log colors it the way a shell colors a command: `cm`
 * quiet, as every line starts with it; the command (with its subcommand: `lock list`, `find branch`) in one color, as
 * it names what ran; options in another, their values plain but for `--format`'s `{fields}` and separators; and a
 * `cm find` query read like SQL: keywords, operators, quoted strings and numbers.
 *
 * The line is the one `commandLineForLog` writes: the arguments joined by spaces, unquoted, so a word is told by its
 * shape, never by where an argument ended. Anything unrecognized stays `plain`: a wrong guess only colors less.
 */
export type CommandLineTokenKind =
  | 'program'
  | 'command'
  | 'option'
  | 'value'
  | 'field'
  | 'separator'
  | 'keyword'
  | 'operator'
  | 'string'
  | 'number'
  | 'plain';

/** A `[start, end)` slice of the line and what it is. The tokens cover the whole line, in order. */
export interface CommandLineToken {
  kind: CommandLineTokenKind;
  start: number;
  end: number;
}

/**
 * The commands the app runs whose second word is a subcommand (`lock list`) or, for `find`, the kind of object looked
 * for. `changelist` is apart: its second word is a subcommand or a changelist's name (`CHANGELIST_SUBCOMMANDS`).
 */
const COMMANDS_WITH_SUBCOMMAND = new Set(['attribute', 'branch', 'changeset', 'codereview', 'find', 'label', 'lock', 'profile', 'repository', 'shelveset', 'workspace']);
/** `cm changelist create|edit|delete <name>`; any other second word is a name, its subcommand next (`cm changelist art add …`). */
const CHANGELIST_SUBCOMMANDS = new Set(['create', 'edit', 'delete']);
const CHANGELIST_ITEM_SUBCOMMANDS = new Set(['add', 'rm']);

/** The words of `cm find`'s query language; `on repository '<repository>'` ends a query run with no workspace. */
const QUERY_KEYWORDS = new Set(['where', 'and', 'or', 'not', 'order', 'by', 'asc', 'desc', 'limit', 'like', 'is', 'null', 'between', 'on', 'repository']);
const QUERY_OPERATOR = /^(=|!=|<>|<|>|<=|>=)$/;
const NUMBER = /^\d+$/;
const SUBCOMMAND = /^[a-z]+$/;
/** A `--format` field (`{changesetid}`), or a separator as the log shows it: its picture (`withControlPictures`). */
const FORMAT_PART = /\{[^{}\s]*\}|[\u2400-\u2421]/g;

/** The tokens of a logged command line (`cm find branch where name = 'x' --format={id}␞`). */
export function commandLineTokens(line: string): CommandLineToken[] {
  const tokens: CommandLineToken[] = [];
  const words: string[] = [];
  let position = 0;
  while (position < line.length) {
    if (/\s/.test(line[position]!)) {
      const end = endOfSpace(line, position);
      push(tokens, 'plain', position, end);
      position = end;
      continue;
    }
    const inQuery = words[1] === 'find';
    const quote = line[position];
    if (inQuery && (quote === "'" || quote === '"')) {
      const closing = line.indexOf(quote, position + 1);
      const end = closing === -1 ? line.length : closing + 1;
      push(tokens, 'string', position, end);
      words.push(line.slice(position, end));
      position = end;
      continue;
    }
    const end = endOfWord(line, position);
    const word = line.slice(position, end);
    pushWord(tokens, word, position, words);
    words.push(word);
    position = end;
  }
  return tokens;
}

/** One word, given the words before it on the line. */
function pushWord(tokens: CommandLineToken[], word: string, start: number, before: readonly string[]): void {
  const end = start + word.length;
  if (before.length === 0 && word === 'cm') return push(tokens, 'program', start, end);
  if (before.length === 1) return push(tokens, 'command', start, end);
  if (isSubcommand(word, before)) return push(tokens, 'command', start, end);
  if (word.length > 1 && word.startsWith('-')) return pushOption(tokens, word, start);
  if (before[1] === 'find') return push(tokens, queryWordKind(word), start, end);
  push(tokens, 'plain', start, end);
}

function isSubcommand(word: string, before: readonly string[]): boolean {
  const command = before[1]!;
  if (command === 'changelist') {
    if (before.length === 2) return CHANGELIST_SUBCOMMANDS.has(word);
    return before.length === 3 && !CHANGELIST_SUBCOMMANDS.has(before[2]!) && CHANGELIST_ITEM_SUBCOMMANDS.has(word);
  }
  return before.length === 2 && COMMANDS_WITH_SUBCOMMAND.has(command) && SUBCOMMAND.test(word);
}

/** `--name`, or `--name=value` with the value's format fields and separators told apart. */
function pushOption(tokens: CommandLineToken[], word: string, start: number): void {
  const equals = word.indexOf('=');
  if (equals === -1) return push(tokens, 'option', start, start + word.length);
  push(tokens, 'option', start, start + equals + 1);
  pushValue(tokens, word.slice(equals + 1), start + equals + 1);
}

function pushValue(tokens: CommandLineToken[], value: string, start: number): void {
  let cursor = 0;
  for (const part of value.matchAll(FORMAT_PART)) {
    push(tokens, 'value', start + cursor, start + part.index);
    push(tokens, part[0].startsWith('{') ? 'field' : 'separator', start + part.index, start + part.index + part[0].length);
    cursor = part.index + part[0].length;
  }
  push(tokens, 'value', start + cursor, start + value.length);
}

function queryWordKind(word: string): CommandLineTokenKind {
  if (QUERY_KEYWORDS.has(word.toLowerCase())) return 'keyword';
  if (QUERY_OPERATOR.test(word)) return 'operator';
  if (NUMBER.test(word)) return 'number';
  return 'plain';
}

/**
 * Adds a token, skipping empty ones (a value that starts with a format field). Plain text joins the plain text before
 * it, so a command over thousands of paths draws them as one run, not a node per word and per space.
 */
function push(tokens: CommandLineToken[], kind: CommandLineTokenKind, start: number, end: number): void {
  if (end <= start) return;
  const last = tokens[tokens.length - 1];
  if (kind === 'plain' && last?.kind === 'plain' && last.end === start) last.end = end;
  else tokens.push({ kind, start, end });
}

function endOfSpace(line: string, start: number): number {
  let end = start;
  while (end < line.length && /\s/.test(line[end]!)) end++;
  return end;
}

function endOfWord(line: string, start: number): number {
  let end = start;
  while (end < line.length && !/\s/.test(line[end]!)) end++;
  return end;
}
