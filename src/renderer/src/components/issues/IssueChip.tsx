import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type MouseEvent } from 'react';
import { api } from '../../api/client';
import { chipName } from '../comments/chipContent';
import { ChipHoverCard } from '../comments/ChipHoverCard';
import { issueCard, issueChipShape, issueUrlToOpen, type IssueReference } from './issueChipShape';
import { issueQuery } from './issueQueries';
import type { PlaceTracker } from './placeTracker';
import styles from '../comments/ReferenceChip.module.css';
import { IssueStatusIcon } from './IssueStatusIcon';

interface IssueChipProps {
  reference: IssueReference;
  source: string;
  tracker: PlaceTracker;
  compact: boolean;
  interactive: boolean;
}

/**
 * An issue a comment names, as `issueChipShape` says it shows: its key, its title in a full comment, its status's dot;
 * its card names its status, type and assignee; a click opens it in the browser. It reads its issue only while its
 * card is open: a comment shown in full reads them all at once (`ResolvedIssues`), and the chip shows what was read.
 */
export function IssueChip({ reference, source, tracker, compact, interactive }: IssueChipProps) {
  const [cardOpen, setCardOpen] = useState(false);
  const { data: read } = useQuery({ ...issueQuery(tracker.connection.id, reference.key), enabled: cardOpen });
  const shape = issueChipShape(reference, source, tracker.connection.kind, read, compact);
  const card = useMemo(() => issueCard(reference, tracker.connection, read), [reference, tracker.connection, read]);
  if (shape.kind === 'text') return <>{source}</>;
  const open = (event: MouseEvent): void => {
    event.stopPropagation();
    event.preventDefault();
    void api.system.openExternal(issueUrlToOpen(read, reference.key, tracker.reader.issueUrl));
  };
  const shown = { className: styles.chip, 'data-icon': 'issue', 'data-source': source, 'data-tip': '' };
  const content = (
    <>
      <IssueStatusIcon category={shape.category} size={compact ? 12 : 13} />
      <span className={styles.label}>{shape.label}</span>
      {shape.summary && <span className={styles.summary}>{shape.summary}</span>}
    </>
  );
  return (
    <ChipHoverCard card={card} onOpenChange={setCardOpen}>
      {interactive ? (
        <a href="#" {...shown} aria-label={chipName(shape.title, shape.summary)} tabIndex={compact ? -1 : undefined} onClick={open} onMouseDown={(event) => event.stopPropagation()}>
          {content}
        </a>
      ) : (
        <span {...shown}>{content}</span>
      )}
    </ChipHoverCard>
  );
}
