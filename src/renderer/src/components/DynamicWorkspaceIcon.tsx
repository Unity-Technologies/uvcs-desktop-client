import type { SVGProps } from 'react';

type DynamicWorkspaceIconProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * A dynamic workspace, which downloads each file when it is first opened: a filled lightning bolt, drawn on a 12-unit
 * grid for the corner badge of a workspace's avatar (`WorkspaceKindBadge`). One color (`currentColor`).
 */
export function DynamicWorkspaceIcon({ size = 12, ...rest }: DynamicWorkspaceIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" focusable="false" shapeRendering="geometricPrecision" {...rest}>
      <path d="M7.2 1 2.6 6.8h3.1L4.8 11l4.6-5.8H6.3Z" />
    </svg>
  );
}
