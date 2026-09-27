import { windowChrome } from '@shared/windowChrome';
import { programPlaceholder } from './programPlaceholder';
import { openFolderLabel, revealLabel } from './revealLabel';
import { trashName } from './trashName';

export const isMac = window.uvcs.platform === 'darwin';

/** How the window draws its title bar; `html[data-chrome]` lets the styles make room for it. */
export const WINDOW_CHROME = windowChrome(window.uvcs.platform);

export const REVEAL_LABEL = revealLabel(window.uvcs.platform);

export const OPEN_FOLDER_LABEL = openFolderLabel(window.uvcs.platform);

export const TRASH_NAME = trashName(window.uvcs.platform);

export const PROGRAM_PLACEHOLDER = programPlaceholder(window.uvcs.platform);
