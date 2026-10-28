import { isolateHistory } from '@codemirror/commands';

/**
 * Marks a change as a step of its own in the editor's history: a chip picked or taken away, a format, a paste or a
 * box ticked is undone alone, never along with the typing right before or after it.
 */
export const ownStep = isolateHistory.of('full');
