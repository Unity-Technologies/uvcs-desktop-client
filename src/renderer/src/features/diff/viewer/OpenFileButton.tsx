import { AppWindow } from 'lucide-react';
import { Button } from '../../../ui/Button';

/** Opens a workspace file the diff can't show in the app it opens with (too large, an image past the limits). */
export function OpenFileButton({ onClick }: { onClick: () => void }) {
  return (
    <Button icon={<AppWindow size={13} />} onClick={onClick}>
      Open file
    </Button>
  );
}
