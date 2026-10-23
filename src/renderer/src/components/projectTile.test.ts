import { describe, expect, it } from 'vitest';
import { projectTileFill } from './projectTile';

describe('projectTileFill', () => {
  it("fills a project's tile with the color its GUID picks", () => {
    expect(projectTileFill({ guid: '9f4c1b2e-0000-4000-8000-00000000000a' })).toBe('var(--project-orange)');
  });

  it("is neutral while the project's GUID isn't read", () => {
    expect(projectTileFill({ guid: undefined })).toBe('var(--project-unknown)');
  });

  it('takes a color named outright', () => {
    expect(projectTileFill({ color: 'indigo' })).toBe('var(--project-indigo)');
  });
});
