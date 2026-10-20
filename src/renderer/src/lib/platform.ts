import { windowChrome } from '@shared/windowChrome';
import { programPlaceholder } from './programPlaceholder';
import { openInFileManagerLabel, revealLabel } from '@shared/revealLabel';
import { trashName } from './trashName';

/** The OS the app runs on, for the pure helpers that take it. */
export const PLATFORM = window.uvcs.platform;

export const isMac = PLATFORM === 'darwin';

/** How the window draws its title bar; `html[data-chrome]` lets the styles make room for it. */
export const WINDOW_CHROME = windowChrome(window.uvcs.platform);

export const REVEAL_LABEL = revealLabel(window.uvcs.platform);

export const OPEN_IN_FILE_MANAGER_LABEL = openInFileManagerLabel(window.uvcs.platform);

export const TRASH_NAME = trashName(window.uvcs.platform);

export const PROGRAM_PLACEHOLDER = programPlaceholder(window.uvcs.platform);
