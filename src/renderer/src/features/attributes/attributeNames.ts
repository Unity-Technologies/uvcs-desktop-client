/** Why an attribute name can't be used, or undefined when it can. */
export function validateAttributeName(name: string): string | undefined {
  return /\s/.test(name) ? 'Attribute names cannot contain spaces.' : undefined;
}
