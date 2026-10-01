/**
 * Windows code signing: electron-builder's sign hook (`win.signtoolOptions.sign` in electron-builder.windows-signed.yml,
 * which the Release workflow adds once the Azure secrets exist). electron-builder calls it for every file it signs (the
 * app's .exe, the installer, its uninstaller); it signs each with Unity's EV certificate in Azure Key Vault through
 * AzureSignTool (the workflow downloads it), then checks the signature names the publisher the updater will ask for
 * (`win.signtoolOptions.publisherName`), so a wrong name fails the release instead of every update after it.
 *
 * One file with no relative imports: electron-builder imports it under Node's own TypeScript support, which needs
 * explicit `.ts` extensions the type checker refuses.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { asArray, parseDn } from 'builder-util-runtime';
import type { CustomWindowsSignTaskConfiguration } from 'app-builder-lib';

const run = promisify(execFile);

/** The Release workflow's secrets that reach the certificate, by the environment variable each arrives in. */
export const AZURE_SIGNING_VARIABLES = [
  'AZURE_KEY_VAULT_URI',
  'AZURE_KEY_VAULT_CERTIFICATE',
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
  'AZURE_CLIENT_SECRET',
] as const;

export type AzureSigningCredentials = Record<(typeof AZURE_SIGNING_VARIABLES)[number], string>;

/** The same server Unity's other Windows binaries are timestamped by; a signature stays valid after the certificate expires. */
export const TIMESTAMP_SERVER = 'http://timestamp.digicert.com';

/** Tries per file: Key Vault and the timestamp server drop a request now and then. */
const SIGNING_ATTEMPTS = 3;

/** Get-AuthenticodeSignature's `Status` for a valid signature (`SignatureStatus.Valid`). */
const VALID_SIGNATURE = 0;

/** The credentials from the environment; throws naming (never showing) the variables that are missing. */
export function azureSigningCredentials(env: NodeJS.ProcessEnv): AzureSigningCredentials {
  const missing = AZURE_SIGNING_VARIABLES.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Windows signing needs ${missing.join(', ')} (the Release workflow's secrets).`);
  }
  return Object.fromEntries(AZURE_SIGNING_VARIABLES.map((name) => [name, env[name]!])) as AzureSigningCredentials;
}

/** AzureSignTool's arguments to sign one file with SHA-256, timestamped, described by the app's name and site. */
export function azureSignToolArguments(
  credentials: AzureSigningCredentials,
  file: string,
  description: string,
  descriptionUrl: string | null,
): string[] {
  return [
    'sign',
    '--azure-key-vault-url', credentials.AZURE_KEY_VAULT_URI,
    '--azure-key-vault-certificate', credentials.AZURE_KEY_VAULT_CERTIFICATE,
    '--azure-key-vault-tenant-id', credentials.AZURE_TENANT_ID,
    '--azure-key-vault-client-id', credentials.AZURE_CLIENT_ID,
    '--azure-key-vault-client-secret', credentials.AZURE_CLIENT_SECRET,
    '--file-digest', 'sha256',
    '--timestamp-rfc3161', TIMESTAMP_SERVER,
    '--timestamp-digest', 'sha256',
    '--description', description,
    ...(descriptionUrl ? ['--description-url', descriptionUrl] : []),
    file,
  ];
}

/**
 * Why a signed file would fail the updater's check, or null when it passes. `signature` is
 * `Get-AuthenticodeSignature | ConvertTo-Json`, as electron-updater reads it (`verifySignature` in
 * windowsExecutableCodeSignatureVerifier): the signature must be valid, and a publisher name must equal the signer's
 * common name (CN) or, written as a full DN, match every field it names.
 */
export function signatureProblem(file: string, signature: string, publisherNames: string[]): string | null {
  const { Status, SignerCertificate } = JSON.parse(signature) as {
    Status?: number;
    SignerCertificate?: { Subject?: string } | null;
  };
  const subject = SignerCertificate?.Subject;
  if (Status !== VALID_SIGNATURE || !subject) return `${file} has no valid signature (status ${Status}).`;

  const signer = parseDn(subject);
  const matches = publisherNames.some((name) => {
    const dn = parseDn(name);
    return dn.size > 0 ? [...dn.keys()].every((key) => dn.get(key) === signer.get(key)) : name === signer.get('CN');
  });
  return matches ? null : `${file} is signed by "${subject}", not by the publisher updates expect (${publisherNames.join(' | ')}).`;
}

/**
 * Runs AzureSignTool, trying again on a failure. A failure reports the tool's output, never the error itself: its
 * message is the whole command line, client secret included.
 */
async function signedByAzureSignTool(file: string, args: string[]): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await run('AzureSignTool', args);
      return;
    } catch (error) {
      const { stdout = '', stderr = '' } = error as { stdout?: string; stderr?: string };
      const output = `${stdout}${stderr}`.trim();
      if (attempt === SIGNING_ATTEMPTS) throw new Error(`AzureSignTool couldn't sign ${file}:\n${output}`);
      console.warn(`  • signing ${file} failed (attempt ${attempt}/${SIGNING_ATTEMPTS}), trying again:\n${output}`);
    }
  }
}

/** The file's signature as JSON. The path goes through the environment, so no quoting reaches PowerShell. */
async function authenticodeSignatureOf(file: string): Promise<string> {
  const command = 'Get-AuthenticodeSignature -LiteralPath $env:SIGNED_FILE | ConvertTo-Json -Compress';
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    env: { ...process.env, SIGNED_FILE: file },
  });
  return stdout;
}

export default async function signWindowsFile(configuration: CustomWindowsSignTaskConfiguration): Promise<void> {
  const publisherNames = asArray(configuration.options.signtoolOptions?.publisherName);
  if (publisherNames.length === 0) throw new Error('Windows signing needs win.signtoolOptions.publisherName.');

  const credentials = azureSigningCredentials(process.env);
  const file = configuration.path;
  await signedByAzureSignTool(file, azureSignToolArguments(credentials, file, configuration.name, configuration.site));

  const problem = signatureProblem(configuration.path, await authenticodeSignatureOf(configuration.path), publisherNames);
  if (problem) throw new Error(problem);
}
