import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { thirdPartyNoticesPath } from './thirdPartyNoticesPath';

describe('thirdPartyNoticesPath', () => {
  const resourcesPath = join('Applications', 'Unity Version Control.app', 'Contents', 'Resources');
  const appPath = join('work', 'uvcs-desktop');

  it("is in an installed app's resources folder, outside app.asar", () => {
    expect(thirdPartyNoticesPath({ isPackaged: true, resourcesPath, appPath })).toBe(join(resourcesPath, 'THIRD_PARTY_NOTICES.txt'));
  });

  it("is in out/ for a build run from the repository, where the build writes it", () => {
    expect(thirdPartyNoticesPath({ isPackaged: false, resourcesPath, appPath })).toBe(join(appPath, 'out', 'THIRD_PARTY_NOTICES.txt'));
  });
});
