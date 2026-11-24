/**
 * Whether every window opens and renders but is never shown: the smoke test's runs (scripts/e2e) then never take the
 * focus from the person working at the computer, while the app's icon in the Dock says one is running. Only for a build
 * run from the checkout (`npm run e2e`), with `UVCS_HIDDEN_WINDOWS=1`, which only the smoke test sets
 * (`hiddenWindows.test.ts`): an installed app always shows its windows, whatever its environment holds.
 *
 * Only on macOS: a window never shown on Windows draws no frames, so every step of the smoke test waited for one and a
 * run took five times as long. There, and on Linux, the windows show as always.
 */
export function windowsStayHidden(environment: NodeJS.ProcessEnv, isPackaged: boolean, platform: NodeJS.Platform): boolean {
  return platform === 'darwin' && !isPackaged && environment.UVCS_HIDDEN_WINDOWS === '1';
}
