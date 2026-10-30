import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { AppMark } from '../../components/AppMark';
import { MarkdownBlocks, MarkdownInlines } from '../../components/Markdown';
import { Button } from '../../ui/Button';
import { SectionTitle } from '../../ui/SectionTitle';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { Spinner } from '../../ui/Spinner';
import { appInfoQuery } from '../about/appInfoQuery';
import { installLabel } from './updateCardStatus';
import { releaseNotesQuery } from './updateReleaseNotes';
import { installUpdate, setReleaseNotesOpen, useUpdateStore } from './updateStore';
import { whatsNewRelease, type WhatsNewNote } from './whatsNewRelease';
import {
  filterSegments,
  toggledRelease,
  whatsNewBody,
  whatsNewSubtitle,
  type FilterSegment,
  type NoteGroup,
  type NotesFilter,
  type ReleaseRow,
  type ReleaseSection,
  type WhatsNewBody,
} from './whatsNewView';
import styles from './ReleaseNotesDialog.module.css';

/** Shows what changed in the update found for `version`, with the button that installs it once it's ready. */
export function openReleaseNotesDialog(version: string): void {
  openDialog((close) => <ReleaseNotesDialog version={version} onClose={close} />);
}

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
        <WhatsNewBodyView
          body={whatsNewBody(releases, filter, unfolded)}
          segments={filterSegments(releases)}
          filter={filter}
          onFilter={setFilter}
          onToggle={(version) => setUnfolded((current) => toggledRelease(current, version))}
        />
      ) : (
        <Spinner size={16} />
      )}
    </Dialog>
  );
}

interface WhatsNewBodyViewProps {
  body: WhatsNewBody;
  segments: FilterSegment[];
  filter: NotesFilter;
  onFilter: (filter: NotesFilter) => void;
  onToggle: (version: string) => void;
}

function WhatsNewBodyView({ body, segments, filter, onFilter, onToggle }: WhatsNewBodyViewProps) {
  if (body.kind === 'empty') return <p className={styles.empty}>Nothing more to show for this update.</p>;
  return (
    <>
      <NotesFilterControl segments={segments} filter={filter} onChange={onFilter} />
      {body.sections.map((section) => (
        <Release key={section.version} section={section} onToggle={() => onToggle(section.version)} />
      ))}
    </>
  );
}

/** The app's segmented control, as its other views pick what they show: each kind with its count, quietly. */
function NotesFilterControl({ segments, filter, onChange }: { segments: FilterSegment[]; filter: NotesFilter; onChange: (filter: NotesFilter) => void }) {
  if (segments.length === 0) return null;
  return (
    <div className={styles.filter}>
      <SegmentedControl<NotesFilter>
        label="Show"
        value={filter}
        onChange={onChange}
        segments={segments.map((segment) => ({
          value: segment.filter,
          label: (
            <>
              {segment.label}
              <span className={styles.count}>{segment.count}</span>
            </>
          ),
        }))}
      />
    </div>
  );
}

function Release({ section, onToggle }: { section: ReleaseSection; onToggle: () => void }) {
  return (
    <section className={styles.release} data-older={section.row ? true : undefined}>
      {section.row && <ReleaseRowHeading row={section.row} open={section.open} onToggle={onToggle} />}
      {section.open && (
        <div className={styles.releaseBody}>
          {section.intro.length > 0 && <MarkdownBlocks blocks={section.intro} images="inline" />}
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
      <SectionTitle as="h4" count={group.notes.length}>
        {group.label}
      </SectionTitle>
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
        <h5 className={styles.noteTitle}>
          <MarkdownInlines inlines={note.title} />
        </h5>
      )}
      {note.description.length > 0 && (
        <div className={styles.description}>
          <MarkdownBlocks blocks={note.description} images="inline" />
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
