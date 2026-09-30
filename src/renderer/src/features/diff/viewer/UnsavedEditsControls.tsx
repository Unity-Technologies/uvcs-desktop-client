import { hotkey } from '../../../lib/shortcutRegistry';
import { Button } from '../../../ui/Button';
import { PaneToolbarGroup } from '../../../ui/PaneToolbar';
import type { FileBuffer } from './useFileBuffer';

/** Discard and Save, in the header of a file with unsaved edits. */
export function UnsavedEditsControls({ buffer }: { buffer: FileBuffer }) {
  return (
    <PaneToolbarGroup>
      <Button size="small" variant="ghost" data-tip="Go back to the file on disk" onClick={buffer.discard}>
        Discard
      </Button>
      <Button
        size="small"
        variant="primary"
        data-tip={buffer.changedOnDisk ? 'Save your version over the one on disk' : 'Save the file'}
        data-tip-shortcut={hotkey('saveFile')}
        onClick={() => void buffer.save()}
      >
        Save
      </Button>
    </PaneToolbarGroup>
  );
}
