import { describe, expect, it } from 'vitest';
import { replicationMessage } from './replicationMessage';

const transferred = (changesets: number) => ({ changesets, labels: 0, items: 0 });

describe('replicationMessage', () => {
  it('counts the changesets a push or a pull brought', () => {
    expect(replicationMessage('push', { branch: '/main', from: 'a@local', to: 'b@local' }, transferred(5))).toBe('Pushed 5 changesets of main to b@local');
    expect(replicationMessage('pull', { branch: '/main/task', from: 'b@local', to: 'a@local' }, transferred(1))).toBe(
      'Pulled 1 changeset of task from b@local',
    );
  });

  it('says the other side already had them all instead of counting none', () => {
    expect(replicationMessage('push', { branch: '/main', from: 'a@local', to: 'b@local' }, transferred(0))).toBe('main is already up to date in b@local');
    expect(replicationMessage('pull', { branch: '/main', from: 'b@local', to: 'a@local' }, transferred(0))).toBe('main is already up to date with b@local');
  });
});
