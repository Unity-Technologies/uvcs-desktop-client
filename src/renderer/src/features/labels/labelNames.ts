const FORBIDDEN_CHARACTERS = /[\s@#:/\\]/;

/** Why a label name can't be used, or undefined when it can. */
export function validateLabelName(name: string): string | undefined {
  return FORBIDDEN_CHARACTERS.test(name) ? 'Labels cannot contain spaces or @ # : / \\ characters.' : undefined;
}
