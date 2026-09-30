import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { useEffect } from 'react';
import { api } from '../../api/client';
import { MarkdownBlocks } from '../../components/Markdown';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { Spinner } from '../../ui/Spinner';
import { installLabel } from './updateCardStatus';
import { releaseNotesQuery, releaseNotesSections, type ReleaseNotesSection } from './updateReleaseNotes';
import { installUpdate, setReleaseNotesOpen, useUpdateStore } from './updateStore';
import styles from './ReleaseNotesDialog.module.css';

/** Shows what changed in the update found for `version`, with the button that installs it once it's ready. */
export function openReleaseNotesDialog(version: string): void {
  openDialog((close) => <ReleaseNotesDialog version={version} onClose={close} />);
}

function ReleaseNotesDialog({ version, onClose }: { version: string; onClose: () => void }) {
  const { data: notes } = useQuery(releaseNotesQuery(version));
  const status = useUpdateStore((state) => state.status);
  const install = status.state === 'ready' && status.version === version ? status.install : null;

  useEffect(() => {
    setReleaseNotesOpen(true);
    return () => setReleaseNotesOpen(false);
  }, []);

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
    <Dialog title={`What's New in ${version}`} width={600} onClose={onClose} footer={footer}>
      {notes ? releaseNotesSections(notes).map((section) => <Release key={section.version} section={section} />) : <Spinner size={16} />}
    </Dialog>
  );
}

function Release({ section }: { section: ReleaseNotesSection }) {
  const { heading, blocks, changelogUrl } = section;
  return (
    <section className={styles.release}>
      {heading && <h3 className={styles.heading}>{heading}</h3>}
      <div className={styles.notes}>
        <MarkdownBlocks blocks={blocks} />
      </div>
      {changelogUrl && (
        <a
          className={styles.changelog}
          href={changelogUrl}
          data-tip={changelogUrl}
          onClick={(event) => {
            event.preventDefault();
            void api.system.openExternal(changelogUrl);
          }}
        >
          Full changelog
          <ArrowUpRight size={12} />
        </a>
      )}
    </section>
  );
}
