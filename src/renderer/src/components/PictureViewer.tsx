import * as RadixDialog from '@radix-ui/react-dialog';
import { ArrowUpRight, X } from 'lucide-react';
import { useRef, type MouseEvent } from 'react';
import { api } from '../api/client';
import { MODAL_DIALOG } from '../lib/modalDialog';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { openDialog } from '../ui/dialog/dialogStore';
import { pictureTitle } from './inlinePictureView';
import styles from './PictureViewer.module.css';

/**
 * Shows a picture larger, over whatever dialog it came from: as large as the window allows and never larger than it
 * is. A click anywhere, Esc or the close button, which it focuses, returns; "Open in Browser" shows it at its full
 * size there.
 */
export function openPictureViewer(url: string, alt: string): void {
  openDialog((close) => <PictureViewer url={url} alt={alt} onClose={close} />);
}

function PictureViewer({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  const keepOpen = (event: MouseEvent): void => event.stopPropagation();
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.content}
          aria-describedby={undefined}
          onClick={onClose}
          // Close takes focus, not "Open in Browser": Enter, which may have opened the picture, then brings the user back.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus();
          }}
          {...MODAL_DIALOG}
        >
          <RadixDialog.Title className="visually-hidden">{pictureTitle(alt)}</RadixDialog.Title>
          <img className={styles.picture} src={url} alt={alt} referrerPolicy="no-referrer" draggable={false} />
          <div className={styles.actions} onClick={keepOpen}>
            <Button size="small" icon={<ArrowUpRight size={14} />} onClick={() => void api.system.openExternal(url)}>
              Open in Browser
            </Button>
            <RadixDialog.Close asChild>
              <IconButton ref={closeRef} icon={<X size={15} />} label="Close" size="small" />
            </RadixDialog.Close>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
