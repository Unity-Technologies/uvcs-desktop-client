import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { AppMark } from '../../components/AppMark';
import { MarkdownBlocks, MarkdownInlines } from '../../components/Markdown';
import { Button } from '../../ui/Button';
import { DetailsBadge } from '../../ui/DetailsBadge';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { Spinner } from '../../ui/Spinner';
import { ToggleChip } from '../../ui/ToggleChip';
import { appInfoQuery } from '../about/appInfoQuery';
import { installLabel } from './updateCardStatus';
import { releaseNotesQuery } from './updateReleaseNotes';
import { installUpdate, setReleaseNotesOpen, useUpdateStore } from './updateStore';
import { whatsNewRelease, type NoteKind, type WhatsNewNote } from './whatsNewRelease';
import {
  filterChips,
  releaseSections,
  toggledRelease,
  whatsNewSubtitle,
  type FilterChip,
  type NoteGroup,
  type NotesFilter,
  type ReleaseRow,
  type ReleaseSection,
} from './whatsNewView';
import styles from './ReleaseNotesDialog.module.css';

/** Shows what changed in the update found for `version`, with the button that installs it once it's ready. */
export function openReleaseNotesDialog(version: string): void {
  openDialog((close) => <ReleaseNotesDialog version={version} onClose={close} />);
}

const KIND_TONES = { new: 'success', improved: 'accent', fixed: 'warning', other: 'neutral' } as const satisfies Record<NoteKind, string>;

function ReleaseNotesDialog({ version, onClose }: { version: string; onClose: () => void }) {
  const { data: notes } = useQuery(releaseNotesQuery(version));
  const { data: info } = useQuery(appInfoQuery);
  const status = useUpdateStore((state) => state.status);
  const install = status.state === 'ready' && status.version === version ? status.install : null;
  const releases = useMemo(() => (notes ?? []).map(whatsNewRelease), [notes]);
  const [filter, setFilter] = useState<NotesFilter>('all');
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setReleaseNotesOpen(true);
    return () => setReleaseNotesOpen(false);
  }, []);

  const subtitle = whatsNewSubtitle(info?.version, releases[0]?.releaseDate ?? null).join(' · ');
  const footer = (
    <>
      {info && <AllReleasesLink url={info.releasesUrl} />}
      {install ? (
        <>
          <Button onClick={onClose}>Later</Button>
          <Button variant="primary" onClick={() => void installUpdate()}>
            {installLabel(install)}
          </Button>
        </>
      ) : (
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      )}
    </>
  );

  return (
    <Dialog icon={<AppMark size={40} />} title={`What's new in ${version}`} description={subtitle || undefined} width={640} onClose={onClose} footer={footer}>
      {notes ? (
        <>
          <FilterChips chips={filterChips(releases)} filter={filter} onChange={setFilter} />
          {releaseSections(releases, filter, unfolded).map((section) => (
            <Release key={section.version} section={section} onToggle={() => setUnfolded((current) => toggledRelease(current, section.version))} />
          ))}
        </>
      ) : (
        <Spinner size={16} />
      )}
    </Dialog>
  );
}

function FilterChips({ chips, filter, onChange }: { chips: FilterChip[]; filter: NotesFilter; onChange: (filter: NotesFilter) => void }) {
  if (chips.length === 0) return null;
  return (
    <div className={styles.chips} role="group" aria-label="Show">
      {chips.map((chip) => (
        <ToggleChip
          key={chip.filter}
          size="small"
          pressed={chip.filter === filter}
          onChange={() => onChange(chip.filter)}
          icon={chip.filter !== 'all' && <span className={styles.swatch} data-kind={chip.filter} aria-hidden />}
        >
          {chip.label}
          <span className={styles.count}>{chip.count}</span>
        </ToggleChip>
      ))}
    </div>
  );
}

function Release({ section, onToggle }: { section: ReleaseSection; onToggle: () => void }) {
  return (
    <section className={styles.release} data-older={section.row ? true : undefined}>
      {section.row && <ReleaseRowHeading row={section.row} open={section.open} onToggle={onToggle} />}
      {section.open && (
        <div className={styles.releaseBody}>
          {section.intro.length > 0 && <MarkdownBlocks blocks={section.intro} />}
          {section.groups.map((group) => (
            <NoteGroupView key={group.kind} group={group} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReleaseRowHeading({ row, open, onToggle }: { row: ReleaseRow; open: boolean; onToggle: () => void }) {
  const content = (
    <>
      <span className={styles.version}>{row.version}</span>
      {row.count && <span className={styles.rowCount}>{row.count}</span>}
    </>
  );
  if (!row.foldable) return <h3 className={styles.row}>{content}</h3>;
  return (
    <h3 className={styles.rowHeading}>
      <button type="button" className={styles.row} aria-expanded={open} onClick={onToggle}>
        <ChevronRight size={14} className={styles.chevron} aria-hidden />
        {content}
      </button>
    </h3>
  );
}

function NoteGroupView({ group }: { group: NoteGroup }) {
  return (
    <div className={styles.group}>
      <div>
        <DetailsBadge tone={KIND_TONES[group.kind]}>{group.label}</DetailsBadge>
      </div>
      {group.notes.map((note, index) => (
        <Note key={index} note={note} />
      ))}
    </div>
  );
}

function Note({ note }: { note: WhatsNewNote }) {
  return (
    <article className={styles.note}>
      {note.title.length > 0 && (
        <h4 className={styles.noteTitle}>
          <MarkdownInlines inlines={note.title} />
        </h4>
      )}
      {note.description.length > 0 && (
        <div className={styles.description}>
          <MarkdownBlocks blocks={note.description} />
        </div>
      )}
    </article>
  );
}

function AllReleasesLink({ url }: { url: string }) {
  return (
    <a
      className={styles.allReleases}
      href={url}
      data-tip={url}
      onClick={(event) => {
        event.preventDefault();
        void api.system.openExternal(url);
      }}
    >
      All releases
      <ArrowUpRight size={12} />
    </a>
  );
}
