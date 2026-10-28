import { memo, useMemo, type ReactNode } from 'react';
import { commentLineInlines } from '../../lib/comments/commentHeading';
import type { MarkdownInline } from '../../lib/markdown';
import { Highlight } from '../../ui/Highlight';
import { copyAsSource } from './copyAsSource';
import { ReferenceChip } from './ReferenceChip';
import styles from './CommentLine.module.css';

interface CommentLineProps {
  comment: string;
  /** False inside something clicked as a whole (a button, a picker's option): its chips are no links (`ReferenceChip`). */
  interactive?: boolean;
  /** What shows for an empty comment, in the caller's style ("No comment"). */
  placeholder?: ReactNode;
}

/**
 * A comment as one line, as a row or a title shows it (`commentLineInlines`; docs/features/rich-comments.md, "Where
 * comments show"): its inline formatting, references as compact chips, emoji; no blocks, no images (their
 * description instead), links as their text. Its words are marked where the list's filter matched (`Highlight`).
 */
export const CommentLine = memo(function CommentLine({ comment, interactive = true, placeholder = null }: CommentLineProps) {
  const inlines = useMemo(() => commentLineInlines(comment), [comment]);
  if (inlines.length === 0) return placeholder;
  return <span onCopy={copyAsSource}>{renderInlines(inlines, interactive)}</span>;
});

function renderInlines(inlines: readonly MarkdownInline[], interactive: boolean): ReactNode[] {
  return inlines.map((inline, index) => {
    switch (inline.kind) {
      case 'text':
        return <Highlight key={index} text={inline.text} />;
      case 'code':
        return (
          <code key={index} className={styles.code}>
            <Highlight text={inline.text} />
          </code>
        );
      case 'strong':
        return <strong key={index}>{renderInlines(inline.children, interactive)}</strong>;
      case 'emphasis':
        return <em key={index}>{renderInlines(inline.children, interactive)}</em>;
      case 'strike':
        return (
          <del key={index} className={styles.strike}>
            {renderInlines(inline.children, interactive)}
          </del>
        );
      case 'link':
        return <span key={index}>{renderInlines(inline.children, interactive)}</span>;
      case 'image':
        return <Highlight key={index} text={inline.alt} />;
      case 'break':
        return ' ';
      case 'reference':
        return <ReferenceChip key={index} reference={inline.reference} source={inline.source} compact interactive={interactive} />;
    }
  });
}
