import { writeFile } from 'node:fs/promises';
import { cmFails, optionValue, type CmFailure, type FakeCmCommand } from './fakeCmClient';

/**
 * The revisions a `cm cat` was asked for, each with the file it was to write: `cat <spec> --file=<file>` or
 * `cat <spec>;<file> …`.
 */
export function catReadsOf(args: readonly string[]): { spec: string; target: string }[] {
  const single = optionValue(args, '--file=');
  if (single !== undefined) return [{ spec: args[1]!, target: single }];
  return args.slice(1).map((arg) => {
    const separator = arg.indexOf(';');
    return { spec: arg.slice(0, separator), target: arg.slice(separator + 1) };
  });
}

/** What `contentOf` answers for a revision whose content a purge removed from the server. */
export const PURGED = Symbol('purged');

/** `cm cat`'s line for a revision whose content was purged: it names the file it was to write, not the spec. */
export function purgedRevisionLine(target: string, revisionId: number): string {
  return `Can't retrieve the content of the file '${target}' because the revision (id:${revisionId}) was purged and its content is no longer available.`;
}

/**
 * `cm cat` as `cm` does it, in either form: every revision `contentOf` knows is written to its file, even when another
 * fails; each one it doesn't know prints `The specified revision was not found <spec>`, each purged one
 * `purgedRevisionLine` (with the spec's number for its id), and either fails the command.
 */
export function fakeCat(contentOf: (spec: string) => string | Buffer | typeof PURGED | undefined): (command: FakeCmCommand) => Promise<string | CmFailure> {
  return async ({ args }) => {
    const failures: string[] = [];
    for (const { spec, target } of catReadsOf(args)) {
      const content = contentOf(spec);
      if (content === undefined) failures.push(`The specified revision was not found ${spec}`);
      else if (content === PURGED) failures.push(purgedRevisionLine(target, Number(/\d+/.exec(spec)?.[0] ?? 0)));
      else await writeFile(target, content);
    }
    return failures.length > 0 ? cmFails(failures.join('\n')) : '';
  };
}
