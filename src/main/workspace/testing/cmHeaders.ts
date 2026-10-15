import type { CmClient } from '../../cm/CmClient';
import { OrganizationServers } from '../../cm/organizationServers';
import { cmHeaderReaders, type HeaderReaders } from '../WorkspaceHeaders';

/** What a workspace is loaded from, read afresh over `cm` (a fake's), with a session of its own for organizations. */
export function cmHeaders(cm: CmClient): HeaderReaders {
  return cmHeaderReaders(cm, new OrganizationServers(cm));
}
