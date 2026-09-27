export const DOWNLOAD_URL = 'https://unity.com/products/version-control/download';

export interface InstallGuidance {
  /** Where to get the installer. */
  downloadLabel: string;
  /** Introduces the terminal alternative. */
  commandNote: string;
  command: string;
}

/** Unity's documented setup (install-uvcs-on-linux): the key in its own keyring, named by `signed-by` (`apt-key` is gone). */
const LINUX_COMMAND = [
  'wget -qO - https://www.plasticscm.com/plasticrepo/stable/ubuntu/Release.key | gpg --dearmor | sudo tee /usr/share/keyrings/plasticscm-stable.gpg > /dev/null',
  'echo "deb [signed-by=/usr/share/keyrings/plasticscm-stable.gpg] https://www.plasticscm.com/plasticrepo/stable/ubuntu ./" | sudo tee /etc/apt/sources.list.d/plasticscm-stable.list',
  'sudo apt-get update && sudo apt-get install plasticscm-client-core',
].join('\n');

/** How to install Unity Version Control (and with it `cm`) on this platform. */
export function installGuidance(platform: string): InstallGuidance {
  switch (platform) {
    case 'darwin':
      return {
        downloadLabel: 'Download for macOS',
        commandNote: 'Prefer the terminal? With Homebrew:',
        command: 'brew install --cask plasticscm-cloud-edition',
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
