import { describe, expect, it } from 'vitest';
import { goToFileWording } from './goToFileScope';

describe('goToFileWording', () => {
  it("names the branch whose latest Files searches", () => {
    expect(goToFileWording({ kind: 'branch', branch: '/main/task-12' })).toEqual({
      name: '/main/task-12',
      description: 'In the latest of /main/task-12',
    });
  });

  it('names the changeset Browse repository searches', () => {
    expect(goToFileWording({ kind: 'changeset', changeset: 4821 })).toEqual({
      name: 'changeset 4821',
      description: 'At changeset 4821',
    });
  });
});
