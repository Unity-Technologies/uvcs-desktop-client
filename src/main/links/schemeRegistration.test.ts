import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LINK_SCHEME } from '@shared/links/formatLink';
import { LINK_SWITCH } from './linkArgument';

const ROOT = join(__dirname, '..', '..', '..');
const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8').replaceAll('\r\n', '\n');

// The installers declare the scheme the app writes and reads, and run it as the app registers itself
// (`registerLinkScheme`): a link must open the same however the app was installed or last launched.
describe('the uvcs:// scheme the installers register', () => {
  it('is the scheme of the links, on macOS and Linux', () => {
    expect(read('electron-builder.yml')).toMatch(new RegExp(`^protocols:\\n {2}name: .+\\n {2}schemes: \\[${LINK_SCHEME}\\]$`, 'm'));
  });

  it('runs on Windows the command the app registers, and goes with the app', () => {
    const installer = read('build/installer.nsh');
    expect(read('electron-builder.yml')).toMatch(/^nsis:\n {2}include: build\/installer\.nsh$/m);
    expect(installer).toContain(`WriteRegStr HKCU "Software\\Classes\\${LINK_SCHEME}\\shell\\open\\command" "" "$\\"$INSTDIR\\\${APP_EXECUTABLE_FILENAME}$\\" ${LINK_SWITCH} -- $\\"%1$\\""`);
    expect(installer).toContain(`WriteRegStr HKCU "Software\\Classes\\${LINK_SCHEME}" "URL Protocol" ""`);
    expect(installer).toContain(`DeleteRegKey HKCU "Software\\Classes\\${LINK_SCHEME}"`);
  });
});
