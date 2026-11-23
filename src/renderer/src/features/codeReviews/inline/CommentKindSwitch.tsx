import type { LineCommentKind } from '@shared/domain/reviewConversation';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { THREAD_KIND_ICONS } from '../conversation/ThreadKindIcon';
import { threadKindName } from '../conversation/threadBadges';
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

/** What a comment being written on a file is (a change request, a question or a comment): it can't change once posted. */
export function CommentKindSwitch({ kind, onChange }: { kind: LineCommentKind; onChange: (kind: LineCommentKind) => void }) {
  return <SegmentedControl small value={kind} segments={KIND_SEGMENTS} onChange={onChange} label="Comment kind" />;
}
