import { describe, expect, it } from 'vitest';
import { compareUnityVersions } from './unityVersion';

const ordered = (versions: string[]) => [...versions].sort(compareUnityVersions);

describe('compareUnityVersions', () => {
  it('puts the newest release first, by number rather than by name', () => {
    expect(ordered(['2022.3.62f3', '6000.0.9f1', '6000.0.77f1', '2021.3.45f2', '6000.3.19f1', '6000.3.7f1'])).toEqual([
      '6000.3.19f1',
      '6000.3.7f1',
      '6000.0.77f1',
      '6000.0.9f1',
      '2022.3.62f3',
      '2021.3.45f2',
    ]);
  });

  it('puts releases before alphas and betas, however new those are', () => {
    expect(ordered(['6000.7.0a2', '6000.5.0f1', '6000.6.0b3', '6000.5.0a5'])).toEqual(['6000.5.0f1', '6000.7.0a2', '6000.6.0b3', '6000.5.0a5']);
  });

  it('counts a patch release as newer than its final, and a China release as a release', () => {
    expect(ordered(['2022.3.10f3', '2022.3.10p1', '2022.3.9c1'])).toEqual(['2022.3.10p1', '2022.3.10f3', '2022.3.9c1']);
  });

  it('puts names that are not versions last', () => {
    expect(ordered(['', 'My Unity', '2021.3.45f2'])).toEqual(['2021.3.45f2', '', 'My Unity']);
  });
});
