import { Fragment } from 'react';
import { breakAfterSlashes } from '../lib/breakAfterSlashes';

/** `text` that wraps after its slashes when it doesn't fit (`breakAfterSlashes`): a long path in a narrow box. */
export function SlashBreakingText({ text }: { text: string }) {
  return (
    <>
      {breakAfterSlashes(text).map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <wbr />}
          {part}
        </Fragment>
      ))}
    </>
  );
}
