import { revealLabel } from './revealLabel';

export const isMac = window.uvcs.platform === 'darwin';

export const REVEAL_LABEL = revealLabel(window.uvcs.platform);
