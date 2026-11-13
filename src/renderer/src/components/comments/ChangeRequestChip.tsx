import { useMemo, type MouseEvent } from 'react';
import { changeRequestChip } from '../../features/codeReviews/changeRequests/changeRequests';
import { useCachedChangeRequest } from './useCachedChangeRequest';
import { chipName } from './chipContent';
import { cardDate, ChipHoverCard } from './ChipHoverCard';
import { CHIP_ICONS } from './chipIcons';
import styles from './ReferenceChip.module.css';

interface ChangeRequestChipProps {
  /** As the comment names it: the first eight digits of its guid, or the whole guid. */
  guid: string;
  source: string;
  compact: boolean;
  interactive: boolean;
}

const Icon = CHIP_ICONS.changeRequest;

/**
 * A change request a check-in applies (`[apply-change:c0d1ce00]`), as `changeRequestChip` says it shows: its first line
 * once the window read its review's conversation (`useCachedChangeRequest`, which reads nothing), else its number; a
 * click opens the review at its thread.
 */
export function ChangeRequestChip({ guid, source, compact, interactive }: ChangeRequestChipProps) {
  const request = useCachedChangeRequest(guid);
  const chip = useMemo(() => changeRequestChip(request, guid, cardDate), [request, guid]);
  const shown = { className: styles.chip, 'data-icon': 'changeRequest', 'data-source': source, 'data-tip': '' };
  const content = (
    <>
      <Icon className={styles.icon} size={compact ? 12 : 13} strokeWidth={2.25} aria-hidden />
      <span className={styles.label}>{chip.label}</span>
    </>
  );
  const opens = chip.opens;
  if (!interactive || !opens) {
    return (
      <ChipHoverCard card={chip.card}>
        <span {...shown} aria-label={chipName(chip.title, request ? chip.label : undefined)}>
          {content}
        </span>
      </ChipHoverCard>
    );
  }
  const open = (event: MouseEvent): void => {
    // In a row, the chip opens the review and leaves the row's selection alone.
    event.stopPropagation();
    event.preventDefault();
    // Loaded on the first click: opening a page reaches the navigation.
    void import('./openChangeRequest').then(({ openChangeRequest }) => openChangeRequest(opens));
  };
  return (
    <ChipHoverCard card={chip.card}>
      <a href="#" {...shown} aria-label={chipName(chip.title, chip.label)} tabIndex={compact ? -1 : undefined} onClick={open} onMouseDown={(event) => event.stopPropagation()}>
        {content}
      </a>
    </ChipHoverCard>
  );
}
