import { MessageSquare } from 'lucide-react';
import { useContext } from 'react';
import { ItemMark } from '../../../components/ItemMark';
import { pluralize } from '../../../lib/text';
import type { EntryMarkProps } from '../../diff/entryMark';
import { fileThreadCount } from './fileAnnotation';
import { reviewDiffViewOf } from './fileThreads';
import { ReviewCommentsContext } from './reviewComments';

/** By a file's status letter in the review's Changes, a comment icon when it holds threads, how many in its tooltip. */
export function ReviewFileMark({ target, entry }: EntryMarkProps) {
  const comments = useContext(ReviewCommentsContext);
  if (!comments?.threads) return null;
  const count = fileThreadCount(comments.threads, comments.review.target, reviewDiffViewOf(comments.review.target, target), entry);
  return count > 0 ? <ItemMark icon={MessageSquare} label={pluralize(count, 'comment')} /> : null;
}
