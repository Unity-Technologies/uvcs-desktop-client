import type { ReactNode } from 'react';
import { pluralize } from '../../../lib/text';
import { displayName } from '../../../lib/userName';
import { AvatarStack } from '../../../ui/AvatarStack';
import { markerCommentCount, markerPeople, type MarkedThreads } from './threadRows';

/** A marker's content: who wrote there, and how many comments there are, as a pull request's do; the outdated ones', after a clock. */
export function CommentMarkerContent({ line, icon }: { line: MarkedThreads; icon?: ReactNode }) {
  const { people, more } = markerPeople(line);
  return (
    <>
      {icon}
      {/* Still: the marker's own tooltip previews its threads (`markerTip`). */}
      <AvatarStack still avatars={people.map((user) => ({ user, tip: displayName(user) }))} size={14} more={more > 0 ? { count: more, tip: pluralize(more, 'other') } : undefined} />
      {markerCommentCount(line)}
    </>
  );
}
