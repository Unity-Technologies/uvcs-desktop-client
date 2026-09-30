import { fileNameOf } from '../../../lib/text';

/** Suggests a new name for the destination item when keeping both, e.g. `logo.png` → `logo-main.png`. */
export function suggestRename(path: string, destinationBranch: string): string {
  const name = fileNameOf(path);
  const suffix = (destinationBranch.split('/').filter(Boolean).at(-1) ?? 'destination').replace(/[^\w.-]+/g, '-');
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)}-${suffix}${name.slice(dot)}` : `${name}-${suffix}`;
}
