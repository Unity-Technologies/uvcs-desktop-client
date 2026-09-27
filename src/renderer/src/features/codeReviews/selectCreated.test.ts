import { describe, expect, it } from 'vitest';
import { selectCreated } from './selectCreated';

describe('selectCreated', () => {
  it('selects the new review once the list shows it', () => {
    expect(selectCreated(['90', '44'], '90')).toEqual({ selected: new Set(['90']), anchor: '90' });
  });

  it('waits while the list has not refreshed yet', () => {
    expect(selectCreated(['44'], '90')).toBeNull();
  });

  it('leaves the selection alone when nothing was created', () => {
    expect(selectCreated(['44'], null)).toBeNull();
  });
});
