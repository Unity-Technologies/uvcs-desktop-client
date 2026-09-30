import type { CmClient, CmRunOptions } from '../CmClient';
import { CmError } from '../CmError';
import { extractErrorMessage } from '../errorMessage';

/** How a command reached `cm`: a pooled `cm shell` (`query`) or a process of its own (`execute`). */
export type CmVia = 'query' | 'execute';

export interface FakeCmCommand {
  via: CmVia;
  args: string[];
  /** The arguments joined by spaces, as the command log shows them without `cm`: `find branch --xml`. */
  line: string;
  options: CmRunOptions;
}

/** What a command prints, exactly as `cm` prints it; a function answers from the command (and may read its files). */
export type CmAnswer = string | CmFailure | ((command: FakeCmCommand) => string | CmFailure | Promise<string | CmFailure>);

/** A command that fails: `cm` printed `output` and exited with `exitCode`. */
export class CmFailure {
  constructor(
    readonly output: string,
    readonly exitCode = 1,
  ) {}
}

/** The answer of a command that fails printing `output`, as `CmClient` reports it: a `CmError` with its message. */
export function cmFails(output: string, exitCode = 1): CmFailure {
  return new CmFailure(output, exitCode);
}

export interface FakeCm {
  /** Hand it to the code under test. */
  cm: CmClient;
  /** Every command asked, in order. */
  commands: FakeCmCommand[];
  /** The command lines asked, in order: `['status --xml', 'find branch ...']`. */
  lines(): string[];
  /** The command lines asked through `via`. */
  linesVia(via: CmVia): string[];
  /** Working directories whose `cm shell` sessions were warmed up. */
  warmedUp: string[];
}

/**
 * A fake `CmClient` that answers from synthetic output, records every command with whether it went through `query`
 * or `execute`, and fails the test on any command it has no answer for.
 *
 * `answers` is keyed by the start of the command line (the arguments joined by spaces): `'find branch'` answers every
 * `cm find branch ...`, and the longest matching key wins, so `'find branch where name'` can answer apart.
 */
export function fakeCmClient(answers: Record<string, CmAnswer> = {}, { executable = 'cm' } = {}): FakeCm {
  const commands: FakeCmCommand[] = [];
  const warmedUp: string[] = [];
  const keys = Object.keys(answers).sort((a, b) => b.length - a.length);

  async function run(via: CmVia, args: string[], options: CmRunOptions = {}): Promise<string> {
    const command: FakeCmCommand = { via, args, line: args.join(' '), options };
    commands.push(command);
    const key = keys.find((candidate) => command.line === candidate || command.line.startsWith(`${candidate} `));
    if (key === undefined) throw new Error(`Unexpected cm command (${via}): cm ${command.line}`);
    const answer = answers[key]!;
    const result = typeof answer === 'function' ? await answer(command) : answer;
    if (result instanceof CmFailure) throw failure(command, result, commands.length);
    return result;
  }

  const fake = {
    executable,
    query: (args: string[], options?: CmRunOptions) => run('query', args, options),
    execute: (args: string[], options?: CmRunOptions) => run('execute', args, options),
    warmUp: (cwd = '') => void warmedUp.push(cwd),
    release: () => undefined,
    relocate: () => undefined,
    onCommandLogged: () => () => undefined,
    onCommandStarted: () => () => undefined,
    dispose: () => undefined,
  } satisfies Partial<Record<keyof CmClient, unknown>>;

  return {
    cm: fake as unknown as CmClient,
    commands,
    lines: () => commands.map((command) => command.line),
    linesVia: (via) => commands.filter((command) => command.via === via).map((command) => command.line),
    warmedUp,
  };
}

function failure(command: FakeCmCommand, { output, exitCode }: CmFailure, logEntryId: number): CmError {
  return new CmError(extractErrorMessage(output), { commandLine: `cm ${command.line}`, exitCode, output: output.trim(), logEntryId });
}

/** The value of an option given as `<prefix><value>` (`-commentsfile=`, `--valuecontents=`), or undefined. */
export function optionValue(args: readonly string[], prefix: string): string | undefined {
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const FIELD_SEPARATOR = '\u001f';
const RECORD_SEPARATOR = '\u001e';

/** `--format` output as `cm` prints it for a `recordFormat`: fields and records ended by control characters, a line per record. */
export function formatOutput(...records: readonly (string | number)[][]): string {
  return records.map((fields) => `${fields.join(FIELD_SEPARATOR)}${RECORD_SEPARATOR}\n`).join('');
}

/** `cm find <object> --xml` output: one `<element>` per record, each field an element of its own. */
export function findXml(element: string, ...records: Record<string, string | number>[]): string {
  const fields = (record: Record<string, string | number>): string =>
    Object.entries(record)
      .map(([name, value]) => `    <${name}>${escapeXml(String(value))}</${name}>`)
      .join('\n');
  const body = records.map((record) => `  <${element}>\n${fields(record)}\n  </${element}>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8" ?>\n<PLASTICQUERY>\n${body}\n</PLASTICQUERY>\n`;
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
