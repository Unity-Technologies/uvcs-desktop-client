import { describe, expect, it } from 'vitest';
import { repositoryWindowTitle } from './windowTitle';

describe('repositoryWindowTitle', () => {
  it('names the repository and its server as the home screen does', () => {
    expect(repositoryWindowTitle('game@local')).toBe('game — This computer');
    expect(repositoryWindowTitle('game@localhost:8087')).toBe('game — localhost:8087');
  });
});
