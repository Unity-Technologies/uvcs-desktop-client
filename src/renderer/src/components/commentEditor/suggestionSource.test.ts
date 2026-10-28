import { describe, expect, it } from 'vitest';
import { listedFrom, suggestionCue, type ListRead } from './suggestionSource';

const pending: ListRead<string> = { data: undefined, isPending: true, isError: false };
const failed: ListRead<string> = { data: undefined, isPending: false, isError: true };
const read = (data: string[]): ListRead<string> => ({ data, isPending: false, isError: false });

describe('listedFrom', () => {
  it('answers from the whole list once it is read, whatever a search found', () => {
    expect(listedFrom(read(['/main', '/main/a']), read(['/main/a']))).toEqual({ items: ['/main', '/main/a'], reading: false, failed: false });
  });

  it('answers from the server’s search of what is typed while the whole list is still being read', () => {
    expect(listedFrom(pending, read(['/main/scm1009']))).toEqual({ items: ['/main/scm1009'], reading: false, failed: false });
    expect(listedFrom(pending, pending)).toEqual({ items: [], reading: true, failed: false });
    expect(listedFrom(pending, null)).toEqual({ items: [], reading: true, failed: false });
  });

  it('says a read failed only once neither the list nor the search can answer, never as an empty repository', () => {
    expect(listedFrom(failed, read(['/main/a']))).toEqual({ items: ['/main/a'], reading: false, failed: false });
    expect(listedFrom(failed, pending)).toEqual({ items: [], reading: true, failed: false });
    expect(listedFrom(failed, failed)).toEqual({ items: [], reading: false, failed: true });
    expect(listedFrom(failed, null)).toEqual({ items: [], reading: false, failed: true });
  });
});

describe('suggestionCue', () => {
  it('marks the word typed once its trigger is read, pulsing while its list is read, and nothing once closed', () => {
    expect(suggestionCue({ recognized: true, dismissed: false, reading: true })).toBe('reading');
    expect(suggestionCue({ recognized: true, dismissed: false, reading: false })).toBe('ready');
    expect(suggestionCue({ recognized: true, dismissed: true, reading: true })).toBeNull();
    expect(suggestionCue({ recognized: false, dismissed: false, reading: false })).toBeNull();
  });
});
