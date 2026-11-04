import { describe, expect, it } from 'vitest';
import { wordMatchRanges } from '../../lib/textMatchRanges';
import { commandLineSegments } from './commandLineSegments';
import { commandLineTokens } from './commandLineTokens';

function segmentsOf(line: string, query: string) {
  return commandLineSegments(line, commandLineTokens(line), wordMatchRanges(line, query)).map(({ kind, text, matched }) => (matched ? `[${kind}:${text}]` : `${kind}:${text}`));
}

describe('commandLineSegments', () => {
  it('draws each token once when nothing is filtered', () => {
    expect(segmentsOf('cm status --xml', '')).toEqual(['program:cm', 'plain: ', 'command:status', 'plain: ', 'option:--xml']);
  });

  it('marks the part of a token the filter matched', () => {
    expect(segmentsOf('cm status --xml', 'tat')).toEqual(['program:cm', 'plain: ', 'command:s', '[command:tat]', 'command:us', 'plain: ', 'option:--xml']);
  });

  it('keeps the colors a match spans across tokens', () => {
    expect(segmentsOf('cm ls --format={id}', 't={i')).toEqual(['program:cm', 'plain: ', 'command:ls', 'plain: ', 'option:--forma', '[option:t=]', '[field:{i]', 'field:d}']);
  });

  it('marks every match, several in one token', () => {
    expect(segmentsOf('cm find branch --format={id}␟{name}', 'n')).toEqual([
      'program:cm',
      'plain: ',
      'command:fi',
      '[command:n]',
      'command:d',
      'plain: ',
      'command:bra',
      '[command:n]',
      'command:ch',
      'plain: ',
      'option:--format=',
      'field:{id}',
      'separator:␟',
      'field:{',
      '[field:n]',
      'field:ame}',
    ]);
  });
});
