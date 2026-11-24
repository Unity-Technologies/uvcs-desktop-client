/**
 * Whether every window opens and renders but is never shown, and on macOS the app never becomes the active one: the
 * smoke test's runs (scripts/e2e) then never take the focus from the person working at the computer. Only for a build
 * run from the checkout (`npm run e2e`), with `UVCS_HIDDEN_WINDOWS=1`, which only the smoke test sets
 * (`hiddenWindows.test.ts`): an installed app always shows its windows, whatever its environment holds.
 */
export function windowsStayHidden(environment: NodeJS.ProcessEnv, isPackaged: boolean): boolean {
  return !isPackaged && environment.UVCS_HIDDEN_WINDOWS === '1';
}
