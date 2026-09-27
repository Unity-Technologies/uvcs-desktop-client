/** Marks the app's modal dialogs (spread on `ui/dialog/Dialog`'s content): while one is open, the window waits. */
export const MODAL_DIALOG = { 'data-modal-dialog': '' } as const;

type Root = Pick<ParentNode, 'querySelector'>;

export function isModalDialogOpen(root: Root = document): boolean {
  return root.querySelector('[data-modal-dialog]') !== null;
}

/**
 * Whether a key pressed in the window may run one of its shortcuts: once per press (a held key doesn't run it again
 * and again), and never behind a modal dialog, whose keys are its own (⌘K would open a palette it can't type into).
 */
export function windowShortcutMayRun(event: Pick<KeyboardEvent, 'repeat'>, root: Root = document): boolean {
  return !event.repeat && !isModalDialogOpen(root);
}
