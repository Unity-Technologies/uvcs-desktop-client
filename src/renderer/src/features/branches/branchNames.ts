const FORBIDDEN_CHARACTERS = /[/\\@#:"'<>|?*\s]/;

/** Returns why a branch name segment is invalid, or undefined when it is fine. */
export function validateBranchName(name: string): string | undefined {
  if (!name) return 'Enter a name.';
  if (FORBIDDEN_CHARACTERS.test(name)) return 'Use letters, numbers, dots, dashes or underscores.';
  if (name.startsWith('.')) return "Names can't start with a dot.";
  return undefined;
}
