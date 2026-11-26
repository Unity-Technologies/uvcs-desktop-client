import { describe, expect, it } from 'vitest';
import type { IssueTrackerSetup } from '@shared/domain/issueTrackers';
import { repositoryGuidFor } from '@shared/testing/stableIdsFor';
import { tracksAnyRepository } from './placeTracker';

const setup = (bindings: IssueTrackerSetup['bindings'], bindingsKeptBySpec: IssueTrackerSetup['bindingsKeptBySpec'] = []): IssueTrackerSetup => ({
  connections: [],
  bindings,
  bindingsKeptBySpec,
  sessionOnly: false,
  deviceFlowHosts: [],
});

describe('tracksAnyRepository', () => {
  it('asks for the repository’s GUID only when some repository uses a tracker', () => {
    expect(tracksAnyRepository(setup([{ repository: repositoryGuidFor(1), connectionId: 'c1', projects: ['VCS'] }]))).toBe(true);
    expect(tracksAnyRepository(setup([]))).toBe(false);
    expect(tracksAnyRepository(undefined)).toBe(false);
  });

  it('asks for it when a binding is still kept by spec, so reading the GUID moves the binding to it', () => {
    expect(tracksAnyRepository(setup([], [{ repository: 'game@acme@unity', connectionId: 'c1', projects: ['VCS'] }]))).toBe(true);
  });
});
