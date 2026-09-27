import { programPlaceholder } from './programPlaceholder';
import { revealLabel } from './revealLabel';
import { trashName } from './trashName';

export const isMac = window.uvcs.platform === 'darwin';

export const REVEAL_LABEL = revealLabel(window.uvcs.platform);

export const TRASH_NAME = trashName(window.uvcs.platform);

export const PROGRAM_PLACEHOLDER = programPlaceholder(window.uvcs.platform);
