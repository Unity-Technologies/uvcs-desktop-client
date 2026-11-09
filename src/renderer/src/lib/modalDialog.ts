/** Marks the app's modal dialogs (spread on `ui/dialog/Dialog`'s content): while one is open, the window waits. */
export const MODAL_DIALOG = { 'data-modal-dialog': '' } as const;

type Root = Pick<ParentNode, 'querySelector'>;

/** Whether an element is inside one of the app's modal dialogs. */
export function isInModalDialog(element: Pick<Element, 'closest'> | null): boolean {
  return element?.closest('[data-modal-dialog]') != null;
}

export function isModalDialogOpen(root: Root = document): boolean {
  return root.querySelector('[data-modal-dialog]') !== null;
}

/**
 * Whether keys pressed in the window reach an element: always while no dialog is open, and while one is, only what
 * is inside it (a diff shown in a dialog steps through its changes; the one behind it waits).
 */
export function keysReach(element: Pick<Element, 'closest'> | null, root: Root = document): boolean {
  return !isModalDialogOpen(root) || isInModalDialog(element);
}

/**
 * Whether a key pressed in the window may run one of its shortcuts: once per press (a held key doesn't run it again
 * and again), and never behind a modal dialog, whose keys are its own (⌘K would open a palette it can't type into).
 */
export function windowShortcutMayRun(event: Pick<KeyboardEvent, 'repeat'>, root: Root = document): boolean {
  return !event.repeat && !isModalDialogOpen(root);
}
