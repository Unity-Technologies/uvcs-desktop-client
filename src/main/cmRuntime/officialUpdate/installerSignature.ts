/**
 * Whether a downloaded installer is Unity's own, before it runs. No checksum is published for the official installers,
 * so their signature is what's checked: Windows' Authenticode, macOS's installer signature and notarization. Each OS
 * checks the signature and its chain itself; this only reads what it found and whose it is.
 */

/** What a signature check found: trusted, or why not, for the details. */
export type SignatureVerdict = { trusted: true } | { trusted: false; why: string };

/**
 * The certificate the official Windows installers are signed with: its subject's common name and organization (seen on
 * 11.0.16.10694's, a DigiCert EV code-signing certificate).
 */
export const WINDOWS_INSTALLER_SIGNERS: readonly { commonName: string; organization: string }[] = [{ commonName: 'Unity Technologies SF', organization: 'Unity Technologies SF' }];

/**
 * The Apple teams whose Developer ID Installer certificate signs the official macOS installers, by team ID, with the
 * name the certificate carries (seen on 11.0.16.10694's).
 */
export const MAC_INSTALLER_TEAMS: Readonly<Record<string, string>> = { BQ7R3Y4J72: 'Codice Software' };

function lineValue(output: string, pattern: RegExp): string | null {
  return pattern.exec(output)?.[1]?.trim() ?? null;
}

/** One part of a certificate subject, `CN=Unity Technologies SF, O=…`, by its key. */
function subjectPart(subject: string, key: string): string | null {
  return subject.split(/,\s*/).find((part) => part.startsWith(`${key}=`))?.slice(key.length + 1) ?? null;
}

/**
 * What `authenticodeCheck`'s script printed (`Status=…` and `Subject=…`, from `Get-AuthenticodeSignature`): trusted when
 * Windows found the signature `Valid` (signed, unchanged since, by a certificate it trusts) and the certificate is
 * Unity's (`WINDOWS_INSTALLER_SIGNERS`).
 */
export function authenticodeVerdict(output: string): SignatureVerdict {
  const status = lineValue(output, /^Status=(.*)$/m);
  if (status !== 'Valid') return { trusted: false, why: `Its signature is ${status || 'unknown'}` };
  const subject = lineValue(output, /^Subject=(.*)$/m) ?? '';
  const signedByUnity = WINDOWS_INSTALLER_SIGNERS.some(
    ({ commonName, organization }) => subjectPart(subject, 'CN') === commonName && subjectPart(subject, 'O') === organization,
  );
  return signedByUnity ? { trusted: true } : { trusted: false, why: `It is signed by ${subject || 'no one'}` };
}

/**
 * What `pkgutil --check-signature` printed for a package: trusted when it's signed for distribution by a certificate
 * Apple issued (pkgutil checks the chain), notarized by Apple, and its Developer ID Installer certificate is one of
 * Unity's teams' (`MAC_INSTALLER_TEAMS`).
 */
export function pkgutilVerdict(output: string): SignatureVerdict {
  const status = lineValue(output, /^\s*Status:(.*)$/m);
  if (status !== 'signed by a developer certificate issued by Apple for distribution') return { trusted: false, why: `Its signature is ${status || 'unknown'}` };
  if (lineValue(output, /^\s*Notarization:(.*)$/m) !== 'trusted by the Apple notary service') return { trusted: false, why: 'It is not notarized by Apple' };
  const signer = lineValue(output, /^\s*1\.\s*(.*)$/m) ?? '';
  const team = /^Developer ID Installer: (.+) \(([A-Z0-9]{10})\)$/.exec(signer);
  const signedByUnity = team !== null && MAC_INSTALLER_TEAMS[team[2]!] === team[1];
  return signedByUnity ? { trusted: true } : { trusted: false, why: `It is signed by ${signer || 'no one'}` };
}
