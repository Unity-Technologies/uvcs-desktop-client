/** A rules file (`ignore.conf`, `cloaked.conf`, `hidden_changes.conf`) with one more rule at its end, in its own line breaks. */
export function withRule(rules: string, pattern: string): string {
  const eol = rules.includes('\r\n') ? '\r\n' : '\n';
  const separator = rules === '' || rules.endsWith('\n') ? '' : eol;
  return `${rules}${separator}${pattern}${eol}`;
}
