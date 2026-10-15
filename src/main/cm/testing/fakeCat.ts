import { writeFile } from 'node:fs/promises';
import { cmFails, optionValue, type CmAnswer } from './fakeCmClient';

/** The revisions a `cm cat` was asked for, each with the file it was to write: `cat <spec> --file=<file>` or `cat <spec>;<file> …`. */
export function catReadsOf(args: readonly string[]): { spec: string; target: string }[] {
  const single = optionValue(args, '--file=');
  if (single !== undefined) return [{ spec: args[1]!, target: single }];
  return args.slice(1).map((arg) => {
    const separator = arg.indexOf(';');
    return { spec: arg.slice(0, separator), target: arg.slice(separator + 1) };
  });
}

/**
 * `cm cat` as `cm` does it, in either form: every revision `contentOf` knows is written to its file, even when another
 * isn't found; each one it doesn't know prints `The specified revision was not found <spec>` and fails the command.
 */
export function catWriting(contentOf: (spec: string) => string | Buffer | undefined): CmAnswer {
  return async ({ args }) => {
    const missing: string[] = [];
    for (const { spec, target } of catReadsOf(args)) {
      const content = contentOf(spec);
      if (content === undefined) missing.push(spec);
      else await writeFile(target, content);
    }
    return missing.length > 0 ? cmFails(missing.map((spec) => `The specified revision was not found ${spec}`).join('\n')) : '';
  };
}
