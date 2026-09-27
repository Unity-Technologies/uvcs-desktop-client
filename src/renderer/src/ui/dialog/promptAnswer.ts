/**
 * What a prompt answers with the text typed: none while it's blank or, unless `acceptInitialValue`, still what it
 * started with (renaming to the same name). A suggested value (a reviewer to assign) can be taken as it is.
 */
export function promptAnswer(value: string, initialValue: string, { acceptInitialValue = false } = {}): string | undefined {
  const trimmed = value.trim();
  return trimmed && (acceptInitialValue || trimmed !== initialValue.trim()) ? trimmed : undefined;
}
