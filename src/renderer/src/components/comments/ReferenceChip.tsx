import { memo, useMemo, type MouseEvent } from 'react';
import type { CommentReference } from '../../lib/comments/commentReferences';
import { displayName } from '../../lib/userName';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';
import { Avatar } from '../../ui/Avatar';
import { cachedRecordOf, cachedSummaryOf } from './cachedSummary';
import { chipCard, chipContent, emojiLabel, personCard, type ChipContent } from './chipContent';
import { cardDate, ChipHoverCard } from './ChipHoverCard';
import { CHIP_ICONS } from './chipIcons';
import { useCachedObject } from './useCachedObject';
import styles from './ReferenceChip.module.css';

interface ReferenceChipProps {
  reference: CommentReference;
  /** The text it was written as: what copying gives back (`copyAsSource`). */
  source: string;
  /** In a row: the object alone, no summary beside it (its tooltip still has it). */
  compact?: boolean;
  /**
   * False inside something clicked as a whole (a button, a picker's option): the chip reads the same but is no link,
   * so the click is the row's.
   */
  interactive?: boolean;
}

/** A changeset, branch, person or emoji a comment names, as `chipContent` says it shows; a click opens an object. */
export const ReferenceChip = memo(function ReferenceChip({ reference, source, compact = false, interactive = true }: ReferenceChipProps) {
  const placeRepository = usePlaceRepository();
  const chip = useMemo(() => chipContent(reference, placeRepository), [reference, placeRepository]);
  switch (chip.kind) {
    case 'emoji':
      return (
        <span className={styles.emoji} data-source={source} data-tip={`:${chip.name}:`} role="img" aria-label={emojiLabel(chip.name)}>
          {chip.glyph}
        </span>
      );
    case 'user':
      return (
        <ChipHoverCard card={personCard(chip.name)}>
          <span className={styles.person} data-source={source} data-tip="">
            <Avatar user={chip.name} size={compact ? 14 : 16} tip={null} />
            {displayName(chip.name)}
          </span>
        </ChipHoverCard>
      );
    case 'object':
      return (
        <ObjectChip
          placeRepository={placeRepository}
          cachedAs={chip.cachedAs}
          source={source}
          compact={compact}
          interactive={interactive}
          icon={chip.icon}
          label={chip.label}
          title={chip.title}
          repository={chip.repository}
          target={chip.target}
        />
      );
  }
});

type ObjectChipProps = Omit<Extract<ChipContent, { kind: 'object' }>, 'kind'> & Omit<ReferenceChipProps, 'reference'> & { placeRepository: string | undefined };

function ObjectChip({ placeRepository, cachedAs, source, compact, interactive, icon, label, title, repository, target }: ObjectChipProps) {
  const place = usePlace();
  const cached = useCachedObject(cachedAs);
  const summary = cached && cachedSummaryOf(cached);
  const card = useMemo(() => chipCard({ title, repository }, cached && cachedRecordOf(cached), cardDate), [title, repository, cached]);
  const Icon = CHIP_ICONS[icon];
  const open = (event: MouseEvent): void => {
    // In a row, the chip opens its object and leaves the row's selection alone.
    event.stopPropagation();
    event.preventDefault();
    // Loaded on the first click: opening a link reaches the windows, the navigation and the queries.
    void import('./openReference').then(({ openReference }) => openReference(place, placeRepository, target));
  };
  // An empty `data-tip`: the app's tooltip of the row or cell around it gives way to the chip's card (`findTip`).
  const shown = { className: styles.chip, 'data-icon': icon, 'data-source': source, 'data-tip': '', 'aria-label': title };
  const content = (
    <>
      <Icon className={styles.icon} size={compact ? 12 : 13} strokeWidth={2.25} aria-hidden />
      <span className={styles.label}>{label}</span>
      {repository && <span className={styles.repository}>{repository}</span>}
      {!compact && summary && <span className={styles.summary}>{summary}</span>}
    </>
  );
  if (!interactive) {
    return (
      <ChipHoverCard card={card}>
        <span {...shown}>{content}</span>
      </ChipHoverCard>
    );
  }
  return (
    <ChipHoverCard card={card}>
      {/* In a row or a title the row's keys reach the object; only a full comment's chips are tab stops. */}
      <a href="#" {...shown} tabIndex={compact ? -1 : undefined} onClick={open} onMouseDown={(event) => event.stopPropagation()}>
        {content}
      </a>
    </ChipHoverCard>
  );
}
