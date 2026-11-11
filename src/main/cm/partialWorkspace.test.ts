import { describe, expect, it } from 'vitest';
import { partialConfigureArgs } from './partialWorkspace';

describe('partialConfigureArgs', () => {
  it('loads or unloads each path from the root, quietly', () => {
    const rules = [{ path: 'Assets/Tex', load: true }, { path: 'Docs ñ', load: false }, { path: 'read me.txt', load: true }];

    expect(partialConfigureArgs(rules)).toEqual(['partial', 'configure', '+/Assets/Tex', '-/Docs ñ', '+/read me.txt', '--silent']);
  });
});
