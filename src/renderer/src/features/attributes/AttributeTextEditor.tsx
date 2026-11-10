import { useState } from 'react';
import { CommentEditor } from '../../components/CommentEditor';
import type { CommentParts } from '../../lib/comment';

interface AttributeTextEditorProps {
  attribute: string;
  /** The value as stored. */
  original: string;
  /** What the editor opens with: the value, or the quick field's draft that outgrew it. */
  initialDraft: string;
  /** Resolves to whether it saved. */
  onSave: (value: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * A long value (release notes, a description) edited as a branch's comment is: Markdown drawn as it reads, chips and
 * suggestions, the larger editor; ⌘↵ saves, Esc cancels, asking first when it was edited.
 */
export function AttributeTextEditor({ attribute, original, initialDraft, onSave, onClose }: AttributeTextEditorProps) {
  const [opened] = useState<CommentParts>(() => ({ summary: '', description: original.trim() }));
  const [draft, setDraft] = useState<CommentParts>(() => ({ summary: '', description: initialDraft }));
  return (
    <CommentEditor
      surface="attributeValue"
      draft={draft}
      original={original}
      opened={opened}
      onChange={setDraft}
      onSave={onSave}
      onClose={onClose}
      descriptionLabel={attribute}
      descriptionPlaceholder="Value"
      discardQuestion={{ title: `Discard your changes to ${attribute}?`, message: 'What you wrote here is lost.', confirmLabel: 'Discard', danger: true }}
    />
  );
}
