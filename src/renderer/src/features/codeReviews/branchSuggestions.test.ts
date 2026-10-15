import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import { branchSuggestions } from './branchSuggestions';

const branch = (name: string, date: string): Branch => ({ id: 0, name, parent: '/main', comment: '', owner: 'ana', date, headChangeset: 1, guid: name, repository: 'game' });

const branches = [
  branch('/main', '2026-01-01T10:00:00'),
  branch('/main/hud', '2026-03-01T10:00:00'),
  branch('/main/hud-lap', '2026-05-01T10:00:00'),
  branch('/main/release/HUD-fixes', '2026-04-01T10:00:00'),
  branch('/main/old-hud', '2026-06-01T10:00:00'),
  branch('/main/huddle/boost', '2026-02-01T10:00:00'),
];
const names = (typed: string, limit?: number) => branchSuggestions(branches, typed, limit).map((each) => each.name);

describe('branchSuggestions', () => {
  it('suggests the branch named, then those whose own name starts with the text, then paths that do, then any holding it, each newest first', () => {
    expect(names('/main/hud')).toEqual(['/main/hud', '/main/hud-lap', '/main/huddle/boost']);
    expect(names('hud')).toEqual(['/main/hud-lap', '/main/release/HUD-fixes', '/main/hud', '/main/old-hud', '/main/huddle/boost']);
  });

  it('matches in any case, ignoring the spaces around', () => {
    expect(names('  Fixes ')).toEqual(['/main/release/HUD-fixes']);
  });

  it('suggests the newest branches while nothing is typed', () => {
    expect(names('', 3)).toEqual(['/main/old-hud', '/main/hud-lap', '/main/release/HUD-fixes']);
  });

  it('suggests a few of the thousands a repository holds', () => {
    const many = Array.from({ length: 5_000 }, (_, index) => branch(`/main/scm${index}`, '2026-01-01T10:00:00'));
    expect(branchSuggestions(many, 'scm1', 30)).toHaveLength(30);
    expect(branchSuggestions(many, '', 30)).toHaveLength(30);
  });

  it('suggests nothing when no branch holds the text', () => {
    expect(names('boost hud')).toEqual([]);
  });
});
