/**
 * Windows code signing: electron-builder's sign hook (`win.signtoolOptions.sign` in electron-builder.windows-signed.yml,
 * which releases build with: docs/features/updates.md). electron-builder calls it for every file it signs (the app's
 * .exe, `elevate.exe`, the installers and their uninstallers); it signs each with Unity's EV certificate in Azure Key
 * Vault through jsign, which runs on any OS: releases build the Windows installers on a macOS runner, far faster than
 * Unity's Windows runners. The files' signatures are checked on real Windows afterwards, the way the updater checks
 * them (`verifyWindowsSignatures.ts`).
 *
 * One file with no relative imports: electron-builder imports it under Node's own TypeScript support, which needs
 * explicit `.ts` extensions the type checker refuses.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CustomWindowsSignTaskConfiguration } from 'app-builder-lib';

const run = promisify(execFile);

/**
 * What reaches the certificate, by the environment variable each arrives in (set by the signing repo's Sign workflow):
 * the vault, the certificate's name in it, an OAuth access token for the vault (an hour long, made from the app
 * registration's credentials, which never reach this process), and the jsign jar.
 */
export const AZURE_SIGNING_VARIABLES = [
  'AZURE_KEY_VAULT_URI',
  'AZURE_KEY_VAULT_CERTIFICATE',
  'AZURE_KEY_VAULT_ACCESS_TOKEN',
  'JSIGN_JAR',
] as const;

export type AzureSigningCredentials = Record<(typeof AZURE_SIGNING_VARIABLES)[number], string>;

/** The same server Unity's other Windows binaries are timestamped by; a signature stays valid after the certificate expires. */
export const TIMESTAMP_SERVER = 'http://timestamp.digicert.com';

/** Timestamp servers are rate limited (Unity's signing docs): jsign tries again this many times, this many seconds apart. */
const TIMESTAMP_RETRIES = 5;
const TIMESTAMP_RETRY_WAIT_SECONDS = 10;

/** The credentials from the environment; throws naming (never showing) the variables that are missing. */
export function azureSigningCredentials(env: NodeJS.ProcessEnv): AzureSigningCredentials {
  const missing = AZURE_SIGNING_VARIABLES.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Windows signing needs ${missing.join(', ')} (docs/features/updates.md).`);
  }
  return Object.fromEntries(AZURE_SIGNING_VARIABLES.map((name) => [name, env[name]!])) as AzureSigningCredentials;
}

/**
 * Java's arguments to sign one file with jsign: SHA-256, timestamped, replacing any signature the file came with,
 * described by the app's name and site.
 */
export function jsignArguments(
  credentials: AzureSigningCredentials,
  file: string,
  description: string,
  descriptionUrl: string | null,
): string[] {
  return [
    '-jar', credentials.JSIGN_JAR,
    '--storetype', 'AZUREKEYVAULT',
    '--keystore', credentials.AZURE_KEY_VAULT_URI,
    '--storepass', credentials.AZURE_KEY_VAULT_ACCESS_TOKEN,
    '--alias', credentials.AZURE_KEY_VAULT_CERTIFICATE,
    '--alg', 'SHA-256',
    '--tsaurl', TIMESTAMP_SERVER,
    '--tsmode', 'RFC3161',
    '--tsretries', String(TIMESTAMP_RETRIES),
    '--tsretrywait', String(TIMESTAMP_RETRY_WAIT_SECONDS),
    '--replace',
    '--name', description,
    ...(descriptionUrl ? ['--url', descriptionUrl] : []),
    file,
  ];
}

/**
 * Signs one file. A failure reports jsign's output, never the error itself: its message is the whole command line,
 * access token included.
 */
export default async function signWindowsFile(configuration: CustomWindowsSignTaskConfiguration): Promise<void> {
  const credentials = azureSigningCredentials(process.env);
  const file = configuration.path;
  try {
    await run('java', jsignArguments(credentials, file, configuration.name, configuration.site));
  } catch (error) {
    const { stdout = '', stderr = '' } = error as { stdout?: string; stderr?: string };
    throw new Error(`jsign couldn't sign ${file}:\n${`${stdout}${stderr}`.trim()}`);
  }
}
