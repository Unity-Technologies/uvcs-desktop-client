import { createContext } from 'react';
import type { BranchChangeRequests } from '../../features/codeReviews/changeRequests/useChangeRequests';

/**
 * The change requests a comment's fields offer to apply (`[apply`, their button): the branch's that the comment's
 * owner read (`useBranchChangeRequests`), a check-in's. None outside such a comment: `[apply` opens nothing there.
 */
export const ChangeRequestsContext = createContext<BranchChangeRequests | null>(null);
