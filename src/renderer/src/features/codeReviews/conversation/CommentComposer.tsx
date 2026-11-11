import { useState, type KeyboardEvent } from 'react';
import { CommentField } from '../../../components/commentEditor/CommentField';
import { useCommentDraftStore } from '../../../components/commentDraftStore';
import { hotkey } from '../../../lib/shortcutRegistry';
import { Button } from '../../../ui/Button';
import { Kbd } from '../../../ui/Kbd';
import { confirm } from '../../../ui/dialog/confirm';
import { cancelAsks, composerText, isSendable } from './composerText';
import styles from './CommentComposer.module.css';

interface CommentComposerProps {
  /** Whose draft it writes (`commentDraftKey`, in its place), kept while the window lives (`useCommentDraftStore`). */
  draftKey: string;
  /** What it starts with when there's no draft: the comment being edited. */
  initialText?: string;
  placeholder: string;
  label: string;
  submitLabel: string;
  /** Resolves to whether it was saved: the field then empties, else keeps the text to try again. */
  onSubmit: (text: string) => Promise<boolean>;
  /** Shows Cancel, which Esc does too: a reply or an edit closes. */
  onCancel?: () => void;
  /** A comment may be saved empty (a description, cleared). */
  allowEmpty?: boolean;
  /** The text goes with something else (a status): sendable empty, as it opened. */
  optional?: boolean;
  autoFocus?: boolean;
  danger?: boolean;
  /** In a popover: no larger editor (`isOwnFocusGroup`). */
  inPopover?: boolean;
  /** Cancel asks before losing what was written: a new comment, which nothing else holds. */
  asksBeforeDiscarding?: boolean;
}

/** The rich editor of a review's comments, as every comment in the app is written; ⌘↵ sends. */
export function CommentComposer({ draftKey, initialText = '', placeholder, label, submitLabel, onSubmit, onCancel, allowEmpty = false, optional = false, autoFocus, danger, inPopover, asksBeforeDiscarding = false }: CommentComposerProps) {
  const draft = useCommentDraftStore((state) => state.drafts[draftKey]);
  const keep = useCommentDraftStore((state) => state.keep);
  const forget = useCommentDraftStore((state) => state.forget);
  const [sending, setSending] = useState(false);
  const text = composerText(draft, initialText);
  const sendable = isSendable(text, initialText, allowEmpty, optional);

  const send = async (): Promise<void> => {
    if (!sendable || sending) return;
    setSending(true);
    const sent = await onSubmit(text);
    setSending(false);
    if (sent) forget(draftKey);
  };

  const cancel = async (): Promise<void> => {
    if (cancelAsks(text, asksBeforeDiscarding) && !(await confirm({ title: 'Discard this comment?', message: "What you wrote isn't kept.", confirmLabel: 'Discard', danger: true }))) return;
    forget(draftKey);
    onCancel?.();
  };

  // Esc reaches here once the field has closed its suggestions.
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !onCancel) return;
    event.stopPropagation();
    void cancel();
  };

  return (
    <div className={styles.composer} onKeyDown={onKeyDown}>
      <CommentField
        className={styles.field}
        value={text}
        onChange={(written) => keep(draftKey, { summary: '', description: written })}
        placeholder={placeholder}
        label={label}
        inPopover={inPopover}
        autoFocus={autoFocus}
        disabled={sending}
        onSubmit={() => void send()}
      />
      <div className={styles.footer}>
        <span className={styles.hint}>
          <Kbd keys={hotkey('saveComment')} /> to send
        </span>
        {onCancel && (
          <Button size="small" variant="ghost" onClick={() => void cancel()} disabled={sending}>
            Cancel
          </Button>
        )}
        <Button size="small" variant={danger ? 'danger' : 'primary'} onClick={() => void send()} loading={sending} disabled={!sendable}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
