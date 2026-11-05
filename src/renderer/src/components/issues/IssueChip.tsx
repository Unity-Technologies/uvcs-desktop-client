import { useQuery } from '@tanstack/react-query';
import { CircleDot } from 'lucide-react';
import { useMemo, useState, type MouseEvent } from 'react';
import { api } from '../../api/client';
import { chipName } from '../comments/chipContent';
import { ChipHoverCard } from '../comments/ChipHoverCard';
import { issueCard, issueChipShape, type IssueReference } from './issueChipShape';
import { issueQuery } from './issueQueries';
import type { PlaceTracker } from './placeTracker';
import styles from '../comments/ReferenceChip.module.css';

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
    void api.system.openExternal(read?.kind === 'found' ? read.issue.url : tracker.reader.issueUrl(reference.key));
  };
  const shown = { className: styles.chip, 'data-icon': 'issue', 'data-source': source, 'data-tip': '' };
  const content = (
    <>
      {shape.category ? <span className={styles.status} data-category={shape.category} aria-hidden /> : <CircleDot className={styles.icon} size={compact ? 12 : 13} strokeWidth={2.25} aria-hidden />}
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
