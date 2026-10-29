import type { Tool, ToolTarget } from '@shared/domain/tools';

/**
 * The official Desktop client's external tools, one a line in `externaltools.conf`:
 * `<target>[:<target>…]|<name>|<program>|<arguments>`, where a target is `Changeset`, `Branch`, `Label` or `Item` (any
 * case), `#` starts a comment, and a line that isn't split in exactly four by `|` is skipped, as it skips it. Its
 * arguments are one command line with `@object`, `@repository` and `@wkpath` replaced as text; here they become one
 * argument each with the app's placeholders. Read once, by `importLegacySettings`; the app never writes the file.
 */
export function readLegacyTools(conf: string): Omit<Tool, 'id'>[] {
  return conf.split(/\r\n|\r|\n/).flatMap((line) => {
    const tool = parseLine(line.trim());
    return tool ? [tool] : [];
  });
}

const TARGETS: Record<string, ToolTarget> = { changeset: 'changeset', branch: 'branch', label: 'label', item: 'item' };

/** The official client's words for what an argument names, and the app's placeholder for each. */
const LEGACY_PLACEHOLDERS: [string, string][] = [
  ['@object', '{object}'],
  ['@repository', '{repository}'],
  ['@wkpath', '{workspace}'],
];

function parseLine(line: string): Omit<Tool, 'id'> | null {
  if (line === '' || line.startsWith('#')) return null;
  const fields = line.split('|').map((field) => field.trim());
  if (fields.length !== 4) return null;
  const [targetField, name, program, argumentLine] = fields as [string, string, string, string];
  const targets = targetField.split(':').map((target) => TARGETS[target.trim().toLowerCase()]);
  if (targets.length === 0 || targets.some((target) => target === undefined) || name === '' || program === '') return null;
  return { name, program, args: splitCommandLine(argumentLine).map(withPlaceholders), targets: [...new Set(targets as ToolTarget[])] };
}

function withPlaceholders(arg: string): string {
  return LEGACY_PLACEHOLDERS.reduce((text, [legacy, placeholder]) => text.split(legacy).join(placeholder), arg);
}

/**
 * One command line split as the official client's programs read it, by the Windows rules .NET uses on every OS:
 * spaces separate arguments, double quotes group them, `""` inside quotes is a quote, and backslashes are literal
 * except before a quote, where each pair is one backslash and an odd one makes the quote literal.
 */
export function splitCommandLine(line: string): string[] {
  const args: string[] = [];
  let current = '';
  let started = false;
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index]!;
    if (char === '\\') {
      let count = 0;
      while (line[index + count] === '\\') count++;
      index += count - 1;
      if (line[index + 1] === '"') {
        current += '\\'.repeat(Math.floor(count / 2));
        if (count % 2 === 1) {
          current += '"';
          index++;
        }
      } else current += '\\'.repeat(count);
      started = true;
    } else if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index++;
      } else quoted = !quoted;
      started = true;
    } else if (!quoted && /\s/.test(char)) {
      if (started) args.push(current);
      current = '';
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (started) args.push(current);
  return args;
}
