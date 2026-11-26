import type { SVGProps } from 'react';

type PartialWorkspaceIconProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * A partial workspace, which holds only some of the repository's files: a circle with its right half filled, drawn on a
 * 12-unit grid for the corner badge of a workspace's avatar (`WorkspaceKindBadge`). One color (`currentColor`).
 */
export function PartialWorkspaceIcon({ size = 12, ...rest }: PartialWorkspaceIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" focusable="false" shapeRendering="geometricPrecision" {...rest}>
      <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth={1.4} />
      <path d="M6 1.8a4.2 4.2 0 0 1 0 8.4Z" />
    </svg>
  );
}
