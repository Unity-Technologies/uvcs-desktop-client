import { Fragment } from 'react';
import { useDialogStore } from './dialogStore';

export function DialogHost() {
  const { dialogs, close } = useDialogStore();
  return dialogs.map((dialog) => <Fragment key={dialog.id}>{dialog.render(() => close(dialog.id))}</Fragment>);
}
