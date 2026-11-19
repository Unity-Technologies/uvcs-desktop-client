import { pinProblems, type CmVersionPin } from '../cmRuntime/cmBundles';
import { releaseFileUrl } from './releaseFeed';

/** The file each release attaches with the `cm` it runs (the Release workflow's "Attach the cm pin"). */
export const CM_PIN_ASSET = 'cm-version.json';

/**
 * The `cm` the release of `version` runs, read from the pin it attaches. A release made before pins were attached has
 * none (404): it runs whatever `cm` is installed, so there is nothing to download for it.
 */
export async function readReleaseCmPin(version: string, fetch: (url: string) => Promise<Response>): Promise<CmVersionPin | null> {
  const url = releaseFileUrl(version, CM_PIN_ASSET);
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  const pin = (await response.json()) as CmVersionPin;
  const problems = pinProblems(pin);
  if (problems.length > 0) throw new Error(`${url}: ${problems.join('; ')}`);
  return pin;
}
