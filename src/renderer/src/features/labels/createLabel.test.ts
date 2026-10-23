import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const switches = vi.hoisted(() => [] as string[]);
vi.mock('../../app/shell/workspaceOperations', () => ({
  switchWorkspace: async (workspacePath: string, target: string) => {
    switches.push(`${workspacePath} ${target}`);
    return true;
  },
}));

import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { shownToasts } from '../../testing/operationOutcome';
import { createLabel, offersSwitchToNewLabel } from './createLabel';

const inWs = workspacePlace('/ws');

beforeEach(() => void switches.splice(0));

describe('creating a label', () => {
  const request = { name: 'v1.0', changesetId: 12, comment: 'First release' };

  it('creates it, closes the dialog, then switches the workspace to it when asked', async () => {
    fakeApi.answer('labels.create', () => undefined);
    const steps: string[] = [];

    await createLabel(inWs, request, { switchAfter: true, onCreated: () => steps.push(`closed with ${switches.length} switches`) });

    expect(fakeApi.argsOf('labels.create')).toEqual([[inWs, request]]);
    expect(steps).toEqual(['closed with 0 switches']);
    expect(switches).toEqual(['/ws lb:v1.0']);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Created label v1.0' }]);
  });

  it('offers no switch in a repository explored without a workspace, and makes none', async () => {
    const place = repositoryPlace('game@local');
    fakeApi.answer('labels.create', () => undefined);

    await createLabel(place, request, { switchAfter: true, onCreated: () => {} });

    expect(offersSwitchToNewLabel(inWs)).toBe(true);
    expect(offersSwitchToNewLabel(place)).toBe(false);
    expect(switches).toEqual([]);
  });

  it('leaves the dialog open, switching nowhere, when the label is not created', async () => {
    fakeApi.answer('labels.create', () => Promise.reject(commandFailure('The label v1.0 already exists')));
    const onCreated = vi.fn();

    await createLabel(inWs, request, { switchAfter: true, onCreated });

    expect(onCreated).not.toHaveBeenCalled();
    expect(switches).toEqual([]);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't create the label", detail: 'The label v1.0 already exists' }]);
  });
});
