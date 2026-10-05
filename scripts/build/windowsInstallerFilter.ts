/**
 * The Windows installer's 7z filter: electron-builder's `beforePack` hook (electron-builder.yml). electron-builder's
 * 7-Zip packs ARM64 executables with the ARM64 filter (7-Zip 23), which the installer's own extractor (nsis7z 19.00, in
 * electron-builder's nsis-resources) can't decode: the arm64 installer would write every file but the app's .exe and
 * DLLs, and its shortcut would ask where the exe went. electron-builder reads ELECTRON_BUILDER_7Z_FILTER each time it
 * packs a 7z archive, so setting it here reaches every Windows build (the signing repository's, CI's, a local
 * `npm run dist`) with no workflow to remember it (docs/features/updates.md "Windows installer").
 *
 * One file with no relative imports: electron-builder imports it under Node's own TypeScript support, which needs
 * explicit `.ts` extensions the type checker refuses.
 */
import type { BeforePackContext } from 'app-builder-lib';

/** x86's branch filter: nsis7z reads it, and it leaves ARM64 code correct, only about 8% less compressed. */
export const WINDOWS_INSTALLER_7Z_FILTER = 'BCJ';

/** Sets the filter in `env` when packing for Windows; only NSIS packs a 7z archive, so no other OS's build changes. */
export function useReadableInstallerFilter(platformName: string, env: NodeJS.ProcessEnv): void {
  if (platformName === 'win32') env.ELECTRON_BUILDER_7Z_FILTER = WINDOWS_INSTALLER_7Z_FILTER;
}

export default function beforePack(context: BeforePackContext): void {
  useReadableInstallerFilter(context.electronPlatformName, process.env);
}
