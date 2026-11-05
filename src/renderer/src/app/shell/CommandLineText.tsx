import { Fragment, useMemo } from 'react';
import { wordMatchRanges } from '../../lib/textMatchRanges';
import { HighlightMark, useHighlightQuery } from '../../ui/Highlight';
import { commandLineSegments } from './commandLineSegments';
import { commandLineTokens } from './commandLineTokens';
import styles from './CommandLogPanel.module.css';

/** A logged command line colored by its parts (`commandLineTokens`), the filter's words marked across them. */
export function CommandLineText({ line }: { line: string }) {
  const query = useHighlightQuery();
  const tokens = useMemo(() => commandLineTokens(line), [line]);
  const segments = useMemo(() => commandLineSegments(line, tokens, wordMatchRanges(line, query)), [line, tokens, query]);
  return (
    <>
      {segments.map((segment, index) => {
        const text = segment.matched ? <HighlightMark>{segment.text}</HighlightMark> : segment.text;
        return segment.kind === 'plain' ? (
          <Fragment key={index}>{text}</Fragment>
        ) : (
          <span key={index} className={styles.token} data-token={segment.kind}>
            {text}
          </span>
        );
      })}
    </>
  );
}
