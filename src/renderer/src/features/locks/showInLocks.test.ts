import '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

const selected = vi.hoisted(() => [] as unknown[][]);
vi.mock('../../app/navigation/viewSelectionStore', () => ({ selectInView: (...args: unknown[]) => void selected.push(args) }));

import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { whereTheWindowIs } from '../../testing/operationOutcome';
import { useLocksViewStore } from './locksViewStore';
import { showInLocks } from './showInLocks';

describe('Show in Locks', () => {
  it("opens Locks on the file's lock among everyone's, clearing the filters that could hide it", () => {
    useLocksViewStore.getState().update({ text: 'shader', people: MINE });

    showInLocks('/ws', { mine: false, owner: 'ana', workspace: 'art-wk', key: 'lock-7' });

    const { text, people } = useLocksViewStore.getState();
    expect({ text, people }).toEqual({ text: '', people: EVERYONE });
    expect(selected).toEqual([['/ws', 'locks', 'lock-7']]);
    expect(whereTheWindowIs().view).toBe('locks');
  });
});
