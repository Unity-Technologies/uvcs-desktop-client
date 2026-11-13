import type { ThemedToken } from '@pierre/diffs';
import { codeTokenStyle } from '../../../components/comments/codeTokenStyle';
import type { SuggestionRow } from './suggestedChange';
import styles from './SuggestedChangeBlock.module.css';

const SIGNS = { removed: '-', added: '+', reading: '' } as const;

/** The block's rows as a diff shows them: a sign, then the line, tinted removed or added; colored once highlighted. */
export function SuggestionRows({ rows, tokens }: { rows: readonly SuggestionRow[]; tokens?: readonly (readonly ThemedToken[])[] }) {
  let textRow = 0;
  return (
    <pre className={styles.rows}>
      <code>
        {rows.map((row, index) => {
          const lineTokens = row.kind === 'reading' ? undefined : tokens?.[textRow++];
          return (
            <span key={index} className={styles.row} data-kind={row.kind}>
              <span className={styles.sign} aria-hidden>
                {SIGNS[row.kind]}
              </span>
              <span className={styles.code}>
                {row.kind === 'reading'
                  ? ' '
                  : lineTokens
                    ? lineTokens.map((token, tokenIndex) => (
                        <span key={tokenIndex} style={codeTokenStyle(token)}>
                          {token.content}
                        </span>
                      ))
                    : row.text || ' '}
              </span>
            </span>
          );
        })}
      </code>
    </pre>
  );
}
