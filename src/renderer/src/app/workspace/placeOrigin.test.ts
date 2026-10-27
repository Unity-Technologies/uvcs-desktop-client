import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { repositoryOfPlace, serverOfPlace } from './placeOrigin';

const workspace = { repository: 'game@acme@cloud', server: 'acme@cloud' };

describe('where a place is from', () => {
  it("is a workspace's repository and server once its info is read, unknown until then", () => {
    expect(repositoryOfPlace(workspacePlace('/wk'), workspace)).toBe('game@acme@cloud');
    expect(serverOfPlace(workspacePlace('/wk'), workspace)).toBe('acme@cloud');
    expect(repositoryOfPlace(workspacePlace('/wk'), undefined)).toBeUndefined();
    expect(serverOfPlace(workspacePlace('/wk'), undefined)).toBeUndefined();
  });

  it("is a repository's own at once, its server read from its spec, a Unity organization's too", () => {
    expect(repositoryOfPlace(repositoryPlace('game@acme@cloud'), undefined)).toBe('game@acme@cloud');
    expect(serverOfPlace(repositoryPlace('game@acme@cloud'), undefined)).toBe('acme@cloud');
    expect(serverOfPlace(repositoryPlace('game@localhost:8087'), undefined)).toBe('localhost:8087');
    expect(serverOfPlace(repositoryPlace('game'), undefined)).toBeUndefined();
  });
});
