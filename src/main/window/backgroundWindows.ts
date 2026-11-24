/**
 * Whether every window shows without ever taking the focus, and the app saves no window bounds or session: an agent's
 * launch (the smoke test, the one-shot screenshot, `app:debug --background`) then never pulls the keyboard away from
 * the person working at the computer, nor changes how their next launch opens, though a window may show over theirs,
 * and the app's icon in the Dock or taskbar says one is running. Only for a build run from the checkout, with
 * `UVCS_BACKGROUND_WINDOWS=1`, which only those scripts set (`backgroundWindows.test.ts`): an installed app always
 * shows and focuses its windows, whatever its environment holds.
 *
 * Shown, not hidden: on Windows a window never shown draws no frames, and each step of a run waited for one.
 */
export function windowsStayInBackground(environment: NodeJS.ProcessEnv, isPackaged: boolean): boolean {
  return !isPackaged && environment.UVCS_BACKGROUND_WINDOWS === '1';
}

/**
 * On Windows, Chromium stops drawing a window it finds covered by others (`CalculateNativeWinOcclusion`): a run's
 * windows, left behind the person's, would wait for frames as a hidden one does. Read before Electron is ready.
 */
export const KEEP_COVERED_WINDOWS_DRAWING = { switch: 'disable-features', value: 'CalculateNativeWinOcclusion' } as const;
