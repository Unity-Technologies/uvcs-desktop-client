import type { ReactNode } from 'react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface NoMatchesProps {
  icon?: ReactNode;
  /** What the list holds, plural: "branches". */
  noun: string;
  /** What else could help, e.g. a longer time range. */
  hint?: string;
  /** "Clear filters": no text, everyone, every kind (`ViewFilterActions.clear`). */
  onClear: () => void;
}

/** What every list shows when its filters hide every row it read: the same words and the same way out. */
export function NoMatches({ icon, noun, hint, onClear }: NoMatchesProps) {
  return <EmptyState icon={icon} title={`No matching ${noun}`} description={hint ?? 'Nothing here matches the filters.'} action={<Button onClick={onClear}>Clear filters</Button>} />;
}
