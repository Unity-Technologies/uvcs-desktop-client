/**
 * Splits arguments typed on one line, as a shell would split them without expanding anything: spaces separate them,
 * double or single quotes keep spaces in one (`-title="Yours ({yoursName})"`).
 */
export function parseArgs(line: string): string[] {
  const args: string[] = [];
  let current = '';
  let started = false;
  let quote: string | null = null;
  for (const char of line) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
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

/** The arguments on one line, quoted where needed so that `parseArgs` reads them back. */
export function formatArgs(args: string[]): string {
  return args.map((arg) => (arg === '' || /[\s"']/.test(arg) ? (arg.includes('"') ? `'${arg}'` : `"${arg}"`) : arg)).join(' ');
}
