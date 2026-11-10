import { describe, expect, it } from 'vitest';
import { workspaceKindOf } from './workspaceKind';

describe('workspaceKindOf', () => {
  it('tells the three kinds as cm getworkspacefrompath prints them', () => {
    expect(workspaceKindOf('regular', 'static')).toBe('standard');
    expect(workspaceKindOf('partial', 'static')).toBe('partial');
    expect(workspaceKindOf('regular', 'dynamic')).toBe('dynamic');
  });

  it('tells a dynamic workspace that is also partial as dynamic', () => {
    expect(workspaceKindOf('partial', 'dynamic')).toBe('dynamic');
  });

  it('reads padded or capitalized values', () => {
    expect(workspaceKindOf(' Partial\r', 'Static ')).toBe('partial');
    expect(workspaceKindOf('Regular ', ' STATIC')).toBe('standard');
  });

  it('tells nothing when cm printed no kind it knows, rather than guess standard', () => {
    expect(workspaceKindOf('', '')).toBeUndefined();
    expect(workspaceKindOf('something', 'else')).toBeUndefined();
  });
});
