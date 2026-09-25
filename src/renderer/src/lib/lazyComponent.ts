import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Loads a component (a named export) only when it is first rendered, keeping heavy screens
 * and libraries out of the startup bundle. Render it inside a `<Suspense>` boundary.
 */
export function lazyComponent<Props extends object>(
  load: () => Promise<ComponentType<Props>>,
): LazyExoticComponent<ComponentType<Props>> {
  return lazy(async () => ({ default: await load() }));
}
