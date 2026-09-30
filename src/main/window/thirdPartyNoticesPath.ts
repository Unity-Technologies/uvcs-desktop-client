import { join } from 'node:path';

const THIRD_PARTY_NOTICES = 'THIRD_PARTY_NOTICES.txt';

/**
 * Where the build left THIRD_PARTY_NOTICES.txt (scripts/build/thirdPartyNoticesPlugin.ts): an installed app has it in
 * its resources folder (electron-builder.yml's `extraResources`, outside app.asar so another app can open it); a build
 * run from the repository (`npm start`), in `out/`.
 */
export function thirdPartyNoticesPath(where: { isPackaged: boolean; resourcesPath: string; appPath: string }): string {
  return where.isPackaged ? join(where.resourcesPath, THIRD_PARTY_NOTICES) : join(where.appPath, 'out', THIRD_PARTY_NOTICES);
}
