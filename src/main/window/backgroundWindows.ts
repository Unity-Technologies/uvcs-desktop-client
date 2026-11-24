/**
 * Whether every window shows without ever taking the focus: the smoke test's runs (scripts/e2e) then never pull the
 * keyboard away from the person working at the computer, though a window may show over theirs, and the app's icon in
 * the Dock or taskbar says a run is on. Only for a build run from the checkout (`npm run e2e`), with
 * `UVCS_BACKGROUND_WINDOWS=1`, which only the smoke test sets (`backgroundWindows.test.ts`): an installed app always
 * shows and focuses its windows, whatever its environment holds.
 *
 * Shown, not hidden: on Windows a window never shown draws no frames, and each step of a run waited for one.
 */
export function windowsStayInBackground(environment: NodeJS.ProcessEnv, isPackaged: boolean): boolean {
  return !isPackaged && environment.UVCS_BACKGROUND_WINDOWS === '1';
}

/**
 * Chromium stops drawing a window it finds covered by others (on Windows, `CalculateNativeWinOcclusion`): a run's
 * windows, left behind the person's, would wait for frames as a hidden one does. Read before Electron is ready.
 */
export const KEEP_COVERED_WINDOWS_DRAWING = { switch: 'disable-features', value: 'CalculateNativeWinOcclusion' } as const;
