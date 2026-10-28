import { Archive, File, GitBranch, GitCommitVertical, Link2, MessageSquareCode, Tag, type LucideIcon } from 'lucide-react';
import { memo, useMemo, type MouseEvent } from 'react';
import type { CommentReference } from '../../lib/comments/commentReferences';
import { displayName } from '../../lib/userName';
import { usePlace } from '../../app/workspace/useWorkspace';
import { Avatar } from '../../ui/Avatar';
import { openReference } from './openReference';
import { chipContent, type ChipIcon } from './chipContent';
import { useCachedSummary } from './useCachedSummary';
import styles from './ReferenceChip.module.css';

const ICONS: Record<ChipIcon, LucideIcon> = {
  changeset: GitCommitVertical,
  branch: GitBranch,
  label: Tag,
  shelve: Archive,
  codeReview: MessageSquareCode,
  file: File,
  link: Link2,
};

interface ReferenceChipProps {
  reference: CommentReference;
  /** The text it was written as: what copying gives back (`copyAsSource`). */
  source: string;
  /** In a row: the object alone, no summary beside it (its tooltip still has it). */
  compact?: boolean;
}

/** A changeset, branch, person or emoji a comment names, as `chipContent` says it shows; a click opens an object. */
export const ReferenceChip = memo(function ReferenceChip({ reference, source, compact = false }: ReferenceChipProps) {
  const chip = useMemo(() => chipContent(reference), [reference]);
  switch (chip.kind) {
    case 'emoji':
      return (
        <span className={styles.emoji} data-source={source} data-tip={`:${chip.name}:`} role="img" aria-label={chip.name.replace(/_/g, ' ')}>
          {chip.glyph}
        </span>
      );
    case 'user':
      return (
        <span className={styles.person} data-source={source} data-tip={chip.name}>
          <Avatar user={chip.name} size={compact ? 14 : 16} tip={null} />
          {displayName(chip.name)}
        </span>
      );
    case 'object':
      return <ObjectChip reference={reference} source={source} compact={compact} icon={chip.icon} label={chip.label} title={chip.title} repository={chip.repository} target={chip.target} />;
  }
});

type ObjectChipProps = Omit<Extract<ReturnType<typeof chipContent>, { kind: 'object' }>, 'kind'> & ReferenceChipProps;

function ObjectChip({ reference, source, compact, icon, label, title, repository, target }: ObjectChipProps) {
  const place = usePlace();
  const summary = useCachedSummary(reference);
  const Icon = ICONS[icon];
  const open = (event: MouseEvent): void => {
    // In a row, the chip opens its object and leaves the row's selection alone.
    event.stopPropagation();
    event.preventDefault();
    void openReference(place, target);
  };
  return (
    <a
      href="#"
      className={styles.chip}
      data-icon={icon}
      data-source={source}
      data-tip={summary ? `${title}: ${summary}` : title}
      data-tip-sub={repository ? `In ${repository}` : undefined}
      onClick={open}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <Icon className={styles.icon} size={compact ? 12 : 13} strokeWidth={2.25} aria-hidden />
      <span className={styles.label}>{label}</span>
      {repository && <span className={styles.repository}>{repository}</span>}
      {!compact && summary && <span className={styles.summary}>{summary}</span>}
    </a>
  );
}
