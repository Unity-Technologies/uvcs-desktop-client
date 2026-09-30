/**
 * The `className` of an element from the classes it may take: those given as `false`, `undefined` or empty (a
 * condition that didn't hold, a `className` prop left out) are dropped, so the attribute never holds `undefined` or
 * stray spaces.
 */
export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
