import { SILENT_FAILURE_MESSAGE } from './CmError';

/** The message of a `cm` failure that only printed the command's usage help. */
export const USAGE_MESSAGE = "cm didn't accept the command's arguments.";

/**
 * Progress chatter ("Please wait ...", "Searching for changed items..."), machine-readable stages, stack frames, and the
 * empty result an `--xml` command prints after its error (`<?xml …?>`, `<RevisionHistoriesResult />`).
 */
const NOISE = [/\.\.\.$/, /^<\w+:.*>$/, /^[A-Z][A-Z_]*$/, /^STAGE\b/, /^at \S+/, /^<[?/]?[A-Za-z][\w.-]*(?:\s[^<>]*)?[?/]?>$/];
const ERROR_PREFIX = /^Error:\s*/;
/** `--machinereadable` errors: `MERGE_NEEDED <sentence>. <field> <field>…`; keeps the sentence. */
const MACHINE_READABLE_ERROR = /^[A-Z][A-Z_]+ (.+\.)(?: [^\s.]+)*$/;
/** "status: Unexpected option --x" printed right before the usage help. */
const COMMAND_PREFIX = /^[a-z]+:\s+/;

/**
 * The one line of a failed command's output that explains the failure. `cm` prints the error
 * last most of the time, but it can be buried under progress lines, stack frames or usage help.
 */
export function extractErrorMessage(output: string): string {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const usageStart = lines.indexOf('Usage:');
  if (usageStart >= 0) {
    // What precedes the usage help is the error (if any) and then the command's one-line description.
    const complaint = lines.slice(0, Math.max(usageStart - 1, 0)).at(-1);
    return complaint?.replace(COMMAND_PREFIX, '') ?? USAGE_MESSAGE;
  }

  const meaningful = lines.filter((line) => !NOISE.some((pattern) => pattern.test(line)));
  const errorLine = meaningful.findLast((line) => ERROR_PREFIX.test(line)) ?? meaningful.at(-1);
  if (!errorLine) return SILENT_FAILURE_MESSAGE;
  return MACHINE_READABLE_ERROR.exec(errorLine)?.[1] ?? errorLine.replace(ERROR_PREFIX, '');
}
