import { Pencil } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { usePlace } from '../../app/workspace/useWorkspace';
import { CommentLine } from '../../components/comments/CommentLine';
import { CommentField } from '../../components/commentEditor/CommentField';
import { oneLineText } from '../../components/commentEditor/commentFieldText';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { renameReview } from './codeReviewOperations';
import { titleToSave } from './reviewTitleEdit';
import styles from './CodeReviewPage.module.css';

/** The review's title and number; the pencil edits the title in place, Enter saving it and Esc leaving it as it was. */
export function ReviewTitle({ review }: { review: CodeReview }) {
  const place = usePlace();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    const title = draft === null ? null : titleToSave(review.title, draft);
    if (title === null) {
      setDraft(null);
      return;
    }
    setSaving(true);
    const saved = await renameReview(place, review.id, title);
    setSaving(false);
    if (saved) setDraft(null);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <div className={styles.titleEditor} onKeyDown={onKeyDown}>
        <CommentField
          singleLine
          className={styles.titleField}
          value={draft}
          onChange={(text) => setDraft(oneLineText(text))}
          label="Title"
          placeholder="What should be reviewed?"
          autoFocus
          disabled={saving}
          onEnter={() => void save()}
          onSubmit={() => void save()}
        />
        <Button size="small" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
          Cancel
        </Button>
        <Button size="small" variant="primary" onClick={() => void save()} loading={saving}>
          Save
        </Button>
      </div>
    );
  }

  return (
    <h1 className={`${styles.title} selectable`}>
      <CommentLine comment={review.title} />{' '}
      {/* The number and the pencil wrap together: the pencil alone, unseen until hovered, left an empty line. */}
      <span className={styles.titleEnd}>
        <span className={styles.id}>#{review.id}</span>
        <span className={styles.titleEdit}>
          <IconButton size="small" icon={<Pencil size={13} />} label="Edit title" onClick={() => setDraft(review.title)} />
        </span>
      </span>
    </h1>
  );
}
