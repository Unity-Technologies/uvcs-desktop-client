import type { RefObject } from 'react';
import type { LineCommentKind } from '@shared/domain/reviewConversation';
import type { CommentFieldHandle } from '../../../components/commentEditor/commentFieldProps';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { THREAD_KIND_ICONS } from '../conversation/ThreadKindIcon';
import { threadKindName } from '../conversation/threadBadges';
import { returnsToFieldAfterPick } from './focusAfterPick';
import { LINE_COMMENT_KINDS } from './newLineComment';

const KIND_SEGMENTS = LINE_COMMENT_KINDS.map((kind) => {
  const name = threadKindName({ kind });
  const Icon = THREAD_KIND_ICONS[name];
  return {
    value: kind,
    label: (
      <>
        <Icon size={12} aria-hidden />
        {name}
      </>
    ),
  };
});

interface CommentKindSwitchProps {
  kind: LineCommentKind;
  onChange: (kind: LineCommentKind) => void;
  /** The comment's text, which a click on a kind gives the focus back to, its caret where it was. */
  field: RefObject<CommentFieldHandle | null>;
}

/** What a comment being written on a file is (a change request, a question or a comment): it can't change once posted. */
export function CommentKindSwitch({ kind, onChange, field }: CommentKindSwitchProps) {
  return (
    <SegmentedControl
      small
      value={kind}
      segments={KIND_SEGMENTS}
      onChange={(picked, pick) => {
        onChange(picked);
        if (returnsToFieldAfterPick(pick)) field.current?.focus();
      }}
      label="Comment kind"
    />
  );
}
