import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/dialog/Dialog';
import { askDialog } from '../../../ui/dialog/dialogStore';

export type UnsavedEditsChoice = 'save' | 'discard';

/** Asks what to do with a file's unsaved edits before leaving it; undefined when the user stays. */
export function askAboutUnsavedEdits(fileName: string): Promise<UnsavedEditsChoice | undefined> {
  return askDialog<UnsavedEditsChoice>((finish) => (
    <Dialog
      title={`Save your edits to ${fileName}?`}
      description="The file on disk doesn't have them yet. If you don't save them, they're lost."
      onClose={() => finish(undefined)}
      onSubmit={() => finish('save')}
      footer={
        <>
          <Button variant="ghost" onClick={() => finish('discard')}>
            Don't save
          </Button>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" autoFocus>
            Save
          </Button>
        </>
      }
    />
  ));
}
