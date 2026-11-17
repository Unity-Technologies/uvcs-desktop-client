import { useEffect, useLayoutEffect, useRef, type DependencyList } from 'react';

/** Whether `deps` hold other values than `last`, the ones an effect last ran for (none yet: it runs). */
export function holdsNewValues(last: DependencyList | undefined, deps: DependencyList): boolean {
  return last === undefined || last.length !== deps.length || deps.some((dep, index) => !Object.is(dep, last[index]));
}

/**
 * An effect that runs for new values of `deps` only, never again for the ones it already ran for. A view kept mounted
 * (`KeptView`) runs its effects again each time it shows: one that scrolls to the selected row, or to the comment gone
 * to, would pull the list back from wherever the user left it. It has no clean-up, as it acts once per value.
 */
export function useNewValuesEffect(effect: () => void, deps: DependencyList): void {
  const ranFor = useRef<DependencyList | undefined>(undefined);
  useEffect(() => {
    if (!holdsNewValues(ranFor.current, deps)) return;
    ranFor.current = deps;
    effect();
  }, deps);
}

/** `useNewValuesEffect` before the paint, as `useLayoutEffect`. */
export function useNewValuesLayoutEffect(effect: () => void, deps: DependencyList): void {
  const ranFor = useRef<DependencyList | undefined>(undefined);
  useLayoutEffect(() => {
    if (!holdsNewValues(ranFor.current, deps)) return;
    ranFor.current = deps;
    effect();
  }, deps);
}
