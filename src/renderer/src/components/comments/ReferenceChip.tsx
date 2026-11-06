import { memo, useMemo, type MouseEvent } from 'react';
import type { CommentReference } from '../../lib/comments/commentReferences';
import { displayName } from '../../lib/userName';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';
import { Avatar } from '../../ui/Avatar';
import { IssueChip } from '../issues/IssueChip';
import { usePlaceTracker } from '../issues/useIssueTrackers';
import { cachedRecordOf, summaryOf } from './cachedSummary';
import { chipCard, chipContent, chipName, emojiLabel, personCard, type ChipContent } from './chipContent';
import { cardDate, ChipHoverCard } from './ChipHoverCard';
import { CHIP_ICONS } from './chipIcons';
import { useCachedObject } from './useCachedObject';
import { useRemoteObject } from './useRemoteObject';
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
  /** An object read as words inside something that frames it already (a pill): no fill, no icon, the color around it. */
  plain?: boolean;
}

/** A changeset, branch, person or emoji a comment names, as `chipContent` says it shows; a click opens an object. */
export const ReferenceChip = memo(function ReferenceChip({ reference, source, compact = false, interactive = true, plain = false }: ReferenceChipProps) {
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
    case 'issue':
      return <PlaceIssueChip reference={chip} source={source} compact={compact} interactive={interactive} />;
    case 'object':
      return (
        <ObjectChip
          reference={reference}
          placeRepository={placeRepository}
          cachedAs={chip.cachedAs}
          source={source}
          compact={compact}
          interactive={interactive}
          plain={plain}
          icon={chip.icon}
          label={chip.label}
          title={chip.title}
          repository={chip.repository}
          target={chip.target}
        />
      );
  }
});

/** An issue of the place's tracker; with none bound (signed out meanwhile), the text it was written as. */
function PlaceIssueChip({ reference, source, compact, interactive }: { reference: { key: string; bare: boolean }; source: string; compact: boolean; interactive: boolean }) {
  const tracker = usePlaceTracker();
  return tracker ? <IssueChip reference={reference} source={source} tracker={tracker} compact={compact} interactive={interactive} /> : <>{source}</>;
}

type ObjectChipProps = Omit<Extract<ChipContent, { kind: 'object' }>, 'kind'> & ReferenceChipProps & { placeRepository: string | undefined };

function ObjectChip({ reference, placeRepository, cachedAs, source, compact, interactive, plain, icon, label, title, repository, target }: ObjectChipProps) {
  const place = usePlace();
  const remote = useRemoteObject(reference, placeRepository);
  const cached = useCachedObject(cachedAs) ?? remote.found;
  const summary = cached && summaryOf(cached);
  const card = useMemo(() => chipCard({ title, repository }, cached && cachedRecordOf(cached), cardDate, remote.unread), [title, repository, cached, remote.unread]);
  const Icon = CHIP_ICONS[icon];
  const open = (event: MouseEvent): void => {
    // In a row, the chip opens its object and leaves the row's selection alone.
    event.stopPropagation();
    event.preventDefault();
    // Loaded on the first click: opening a link reaches the windows, the navigation and the queries.
    void import('./openReference').then(({ openReference }) => openReference(place, placeRepository, target));
  };
  // An empty `data-tip`: the app's tooltip of the row or cell around it gives way to the chip's card (`findTip`).
  const shown = { className: plain ? styles.plain : styles.chip, 'data-icon': icon, 'data-source': source, 'data-tip': '' };
  const content = (
    <>
      {!plain && <Icon className={styles.icon} size={compact ? 12 : 13} strokeWidth={2.25} aria-hidden />}
      <span className={styles.label}>{label}</span>
      {repository && <span className={styles.repository}>{repository}</span>}
      {!compact && summary && <span className={styles.summary}>{summary}</span>}
    </>
  );
  if (!interactive) {
    return (
      <ChipHoverCard card={card} onOpenChange={remote.cardOpen}>
        <span {...shown}>{content}</span>
      </ChipHoverCard>
    );
  }
  return (
    <ChipHoverCard card={card} onOpenChange={remote.cardOpen}>
      {/* In a row or a title the row's keys reach the object; only a full comment's chips are tab stops. */}
      <a href="#" {...shown} aria-label={chipName(title, compact ? undefined : summary || undefined)} tabIndex={compact ? -1 : undefined} onClick={open} onMouseDown={(event) => event.stopPropagation()}>
        {content}
      </a>
    </ChipHoverCard>
  );
}
