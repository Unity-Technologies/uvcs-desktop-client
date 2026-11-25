/**
 * `cm` refuses `@ # / : " ? '` and line breaks in a branch name, and takes spaces (a `cm shell` line quotes an
 * argument holding one: `toShellCommandLine`). The app refuses `\ < > | *` too: a new task workspace's folder is
 * named after its branch (`defaultTaskFolder`), and Windows refuses those in a folder name. Tabs are refused
 * too: nobody means one in a name.
 */
const FORBIDDEN_CHARACTERS = /[/\\@#:"'<>|?*\r\n\t]/;

/** Returns why a branch name segment is invalid, or undefined when it is fine. Callers trim it first, as `cm shell` would. */
export function validateBranchName(name: string): string | undefined {
  if (!name) return 'Enter a name.';
  if (FORBIDDEN_CHARACTERS.test(name)) return 'Use letters, numbers, spaces, dots, dashes or underscores.';
  if (name.startsWith('.')) return "Names can't start with a dot.";
  return undefined;
}
