import { describe, expect, it } from 'vitest';
import { installGuidance } from './installGuidance';

describe('installGuidance', () => {
  it('offers each platform its package manager, under the names they use today', () => {
    expect(installGuidance('darwin').command).toBe('brew install --cask unity-version-control');
    expect(installGuidance('win32').command).toBe('winget install Codice.PlasticSCM.CloudEdition');
    expect(installGuidance('linux').command).toMatch(/apt-get install plasticscm-client-core$/);
  });

  it('adds Unity’s current Linux repository with its key in its own keyring, never the old one or apt-key', () => {
    const { command, commandNote } = installGuidance('linux');
    expect(command.split('\n')).toEqual([
      'sudo install -d /etc/apt/keyrings',
      'wget -O - https://uvcs.unity3d.com/linux/keys/public | sudo gpg --dearmor -o /etc/apt/keyrings/uvcs.gpg',
      'echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/uvcs.gpg] https://uvcs.unity3d.com/linux/repos/deb stable main" | sudo tee /etc/apt/sources.list.d/uvcs.list',
      'sudo apt-get update && sudo apt-get install plasticscm-client-core',
    ]);
    expect(command).not.toMatch(/apt-key|plasticscm\.com/);
    expect(commandNote).toMatch(/Debian or Ubuntu/);
  });
});
