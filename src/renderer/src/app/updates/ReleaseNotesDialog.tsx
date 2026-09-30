import { useQuery } from '@tanstack/react-query';
import { MarkdownBlocks } from '../../components/Markdown';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { Spinner } from '../../ui/Spinner';
import { installLabel } from './updateCardStatus';
import { releaseNotesQuery, releaseNotesSections } from './updateReleaseNotes';
import { installUpdate, useUpdateStore } from './updateStore';
import styles from './ReleaseNotesDialog.module.css';

/** Shows what changed in the update found for `version`, with the button that installs it once it's ready. */
export function openReleaseNotesDialog(version: string): void {
  openDialog((close) => <ReleaseNotesDialog version={version} onClose={close} />);
}

function ReleaseNotesDialog({ version, onClose }: { version: string; onClose: () => void }) {
  const { data: notes } = useQuery(releaseNotesQuery(version));
  const status = useUpdateStore((state) => state.status);
  const install = status.state === 'ready' && status.version === version ? status.install : null;

  const footer = install ? (
    <>
      <Button onClick={onClose}>Close</Button>
      <Button variant="primary" onClick={() => void installUpdate()}>
        {installLabel(install)}
      </Button>
    </>
  ) : (
    <Button variant="primary" onClick={onClose}>
      Close
    </Button>
  );

  return (
    <Dialog title={`What's New in ${version}`} width={560} onClose={onClose} footer={footer}>
      {notes ? (
        releaseNotesSections(notes).map((section) => (
          <section key={section.version} className={styles.release}>
            {section.heading && <h3 className={styles.heading}>{section.heading}</h3>}
            <MarkdownBlocks blocks={section.blocks} />
          </section>
        ))
      ) : (
        <Spinner size={16} />
      )}
    </Dialog>
  );
}
