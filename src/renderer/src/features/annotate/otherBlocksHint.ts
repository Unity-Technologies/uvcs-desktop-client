import { pluralize } from '../../lib/text';

/**
 * What a block's card says of the changeset's other blocks: nothing when there are none; to click the block while it
 * isn't picked; once they're highlighted, how many, and the key that goes to the next (`nextKey`), unless a person
 * removed it.
 */
export type OtherBlocksHint = { kind: 'none' } | { kind: 'click'; text: string } | { kind: 'highlighted'; text: string; nextKey: string | undefined };

export function otherBlocksHint(others: number, highlighted: boolean, nextKey: string | undefined): OtherBlocksHint {
  if (others === 0) return { kind: 'none' };
  if (!highlighted) return { kind: 'click', text: `Click the block to highlight its ${pluralize(others, 'other block')}` };
  return { kind: 'highlighted', text: `${pluralize(others, 'other block')} highlighted`, nextKey };
}
