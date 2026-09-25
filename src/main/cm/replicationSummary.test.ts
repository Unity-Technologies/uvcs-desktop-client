import { describe, expect, it } from 'vitest';
import { parseReplicationSummary } from './replicationSummary';

describe('parseReplicationSummary', () => {
  it('reads the totals printed after a push', () => {
    const output = ['OperationStartingPush. 100 %', 'DataWritten', 'Items 1', 'Revs 2', 'Changesets 3', 'Labels 0', 'Applied labels 0'].join('\n');
    expect(parseReplicationSummary(output)).toEqual({ changesets: 3, labels: 0, items: 1 });
  });

  it('reports zero when nothing was transferred', () => {
    expect(parseReplicationSummary('Nothing to replicate')).toEqual({ changesets: 0, labels: 0, items: 0 });
  });
});
