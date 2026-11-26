import type { ReactNode } from 'react';
import { Button } from '../Button';
import { Dialog } from './Dialog';
import { askDialog } from './dialogStore';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  /** "Cancel" unless the question only offers something extra, where declining is "OK". */
  cancelLabel?: string;
  danger?: boolean;
}

export async function confirm({ title, message, confirmLabel, cancelLabel = 'Cancel', danger }: ConfirmOptions): Promise<boolean> {
  const answer = await askDialog<boolean>((finish) => (
    <Dialog
      title={title}
      description={message}
      onClose={() => finish(false)}
      onSubmit={() => finish(true)}
      footer={
        <>
          <Button onClick={() => finish(false)}>{cancelLabel}</Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    />
  ));
  return answer === true;
}
