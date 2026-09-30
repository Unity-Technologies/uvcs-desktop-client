import '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));

import { answerPrompts } from '../../testing/fakeDialogs';
import { whereTheWindowIs } from '../../testing/operationOutcome';
import { browseRepositoryAtChangeset } from './browseRepositoryAtChangeset';

describe('browseRepositoryAtChangeset', () => {
  it('browses the changeset typed as a number or as its spec', async () => {
    answerPrompts('12', ' cs:40 ');

    await browseRepositoryAtChangeset();
    await browseRepositoryAtChangeset();

    expect(whereTheWindowIs().pages).toEqual([
      { kind: 'browseRepository', changesetId: 12 },
      { kind: 'browseRepository', changesetId: 40 },
    ]);
  });

  it('goes nowhere for what is not a changeset, or when cancelled', async () => {
    answerPrompts('sh:3', 'main', '12abc', undefined);

    for (let i = 0; i < 4; i++) await browseRepositoryAtChangeset();

    expect(whereTheWindowIs().pages).toEqual([]);
  });
});
