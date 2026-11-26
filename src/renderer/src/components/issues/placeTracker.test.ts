import { describe, expect, it } from 'vitest';
import type { IssueTrackerSetup } from '@shared/domain/issueTrackers';
import { repositoryGuidFor } from '@shared/testing/stableIdsFor';
import { tracksAnyRepository } from './placeTracker';

const setup = (bindings: IssueTrackerSetup['bindings']): IssueTrackerSetup => ({ connections: [], bindings, sessionOnly: false, deviceFlowHosts: [] });

describe('tracksAnyRepository', () => {
  it('asks for the repository’s GUID only when some repository uses a tracker', () => {
    expect(tracksAnyRepository(setup([{ repository: repositoryGuidFor(1), connectionId: 'c1', projects: ['VCS'] }]))).toBe(true);
    expect(tracksAnyRepository(setup([]))).toBe(false);
    expect(tracksAnyRepository(undefined)).toBe(false);
  });
});
