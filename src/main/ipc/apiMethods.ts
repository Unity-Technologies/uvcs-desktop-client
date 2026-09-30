import type { UvcsApi } from '@shared/api';

export type ApiMethod = (...args: unknown[]) => Promise<unknown>;

/** Every method of the API by the name a page calls it with: `<area>.<method>` (`branches.list`). */
export function apiMethods(api: UvcsApi): Map<string, ApiMethod> {
  const methods = new Map<string, ApiMethod>();
  for (const [area, service] of Object.entries(api)) {
    for (const [name, method] of Object.entries(service as Record<string, ApiMethod>)) {
      methods.set(`${area}.${name}`, method);
    }
  }
  return methods;
}
