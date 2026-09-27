/** What a prompt answers with the text typed: none while it's blank or still what it started with (renaming to the same name). */
export function promptAnswer(value: string, initialValue: string): string | undefined {
  const trimmed = value.trim();
  return trimmed && trimmed !== initialValue.trim() ? trimmed : undefined;
}
