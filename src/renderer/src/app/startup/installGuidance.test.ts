import { describe, expect, it } from 'vitest';
import { installGuidance } from './installGuidance';

describe('installGuidance', () => {
  it('offers each platform its package manager', () => {
    expect(installGuidance('darwin').command).toBe('brew install --cask plasticscm-cloud-edition');
    expect(installGuidance('win32').command).toBe('winget install Codice.PlasticSCM.CloudEdition');
    expect(installGuidance('linux').command).toMatch(/apt-get install plasticscm-client-core$/);
  });

  it('adds the Linux repository key the way current Ubuntu takes it, never with the removed apt-key', () => {
    const { command } = installGuidance('linux');
    expect(command).not.toContain('apt-key');
    expect(command).toContain('gpg --dearmor | sudo tee /usr/share/keyrings/plasticscm-stable.gpg');
    expect(command).toContain('deb [signed-by=/usr/share/keyrings/plasticscm-stable.gpg] https://www.plasticscm.com/plasticrepo/stable/ubuntu ./');
  });
});
