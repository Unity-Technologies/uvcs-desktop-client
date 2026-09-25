import { describe, expect, it } from 'vitest';
import { installGuidance } from './installGuidance';

describe('installGuidance', () => {
  it('offers each platform its package manager', () => {
    expect(installGuidance('darwin').command).toBe('brew install --cask plasticscm-cloud-edition');
    expect(installGuidance('win32').command).toBe('winget install Codice.PlasticSCM.CloudEdition');
    expect(installGuidance('linux').command).toMatch(/apt-get install plasticscm-client-core$/);
  });
});
