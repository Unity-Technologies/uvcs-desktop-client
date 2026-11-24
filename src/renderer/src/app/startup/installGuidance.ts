export const DOWNLOAD_URL = 'https://unity.com/products/version-control/download';

export interface InstallGuidance {
  /** Where to get the installer. */
  downloadLabel: string;
  /** Introduces the terminal alternative. */
  commandNote: string;
  command: string;
}

/**
 * Unity's documented setup for Debian and Ubuntu (install-uvcs-on-linux): its repository at uvcs.unity3d.com, whose key
 * goes in its own keyring, named by `signed-by` (`apt-key` is gone). The older plasticscm.com repository is one the
 * docs now say to remove.
 */
const LINUX_COMMAND = [
  'sudo install -d /etc/apt/keyrings',
  'wget -O - https://uvcs.unity3d.com/linux/keys/public | sudo gpg --dearmor -o /etc/apt/keyrings/uvcs.gpg',
  'echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/uvcs.gpg] https://uvcs.unity3d.com/linux/repos/deb stable main" | sudo tee /etc/apt/sources.list.d/uvcs.list',
  'sudo apt-get update && sudo apt-get install plasticscm-client-core',
].join('\n');

/** How to install Unity Version Control (and with it `cm`) on this platform. */
export function installGuidance(platform: string): InstallGuidance {
  switch (platform) {
    case 'darwin':
      return {
        downloadLabel: 'Download for macOS',
        commandNote: 'Prefer the terminal? With Homebrew:',
        // Homebrew renamed the cask from plasticscm-cloud-edition.
        command: 'brew install --cask unity-version-control',
      };
    case 'win32':
      return {
        downloadLabel: 'Download for Windows',
        commandNote: 'Prefer the terminal? With winget:',
        command: 'winget install Codice.PlasticSCM.CloudEdition',
      };
    default:
      return {
        downloadLabel: 'Download for Linux',
        commandNote: 'On Debian or Ubuntu, only the command line client:',
        command: LINUX_COMMAND,
      };
  }
}
