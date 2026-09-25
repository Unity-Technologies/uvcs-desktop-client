import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Button } from './Button';
import { DetailsSection, DetailsText } from './DetailsPanel';
import { Kbd } from './Kbd';
import styles from './DetailsComment.module.css';
import { hotkey } from '../lib/shortcutRegistry';

interface DetailsCommentProps {
  text: string;
  /** Saves an edited comment; without it the comment is read-only (cm can't change it for every object). */
  onSave?: (comment: string) => Promise<unknown>;
}

/** The "Comment" card of a details panel, edited in place: ⌘↵ saves, Escape cancels, an empty comment is fine. */
export function DetailsComment({ text, onSave }: DetailsCommentProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    if (draft === null || !onSave) return;
    if (draft.trim() !== text.trim()) {
      setSaving(true);
      await onSave(draft.trim());
      setSaving(false);
    }
    setDraft(null);
  };

  const edit = onSave && draft === null ? () => setDraft(text) : undefined;

  return (
    <DetailsSection
      title="Comment"
      action={
        edit && (
          <Button variant="ghost" size="small" icon={<Pencil size={12} />} onClick={edit}>
            Edit
          </Button>
        )
      }
    >
      {draft === null ? (
        edit ? (
          <div
            className={styles.text}
            role="button"
            tabIndex={0}
            onClick={edit}
            onKeyDown={(event) => event.key === 'Enter' && edit()}
            data-tip="Click to edit"
          >
            <DetailsText text={text} placeholder="No comment. Click to add one." />
          </div>
        ) : (
          <DetailsText text={text} placeholder="No comment" />
        )
      ) : (
        <div className={styles.editing}>
          <textarea
            className={styles.editor}
            value={draft}
            autoFocus
            rows={Math.min(12, Math.max(3, draft.split('\n').length + 1))}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void save();
              } else if (event.key === 'Escape') {
                event.stopPropagation();
                setDraft(null);
              }
            }}
          />
          <div className={styles.footer}>
            <span className={styles.hint}>
              <Kbd keys={hotkey('saveComment')} /> to save
            </span>
            <Button size="small" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
            <Button size="small" variant="primary" onClick={() => void save()} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      )}
    </DetailsSection>
  );
}
