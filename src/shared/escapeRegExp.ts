/** Text as a regular expression that matches it literally: every character a pattern gives a meaning is escaped. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
