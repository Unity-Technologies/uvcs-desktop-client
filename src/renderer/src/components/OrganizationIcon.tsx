import type { SVGProps } from 'react';

type OrganizationIconProps = SVGProps<SVGSVGElement> & { size?: number };

/** The building Unity's own apps draw for an organization, on its 256-unit grid: a filled outline of 12-unit strokes. */
const BUILDING_PATH =
  'M240,204H228V96a20,20,0,0,0-20-20H172V32a20,20,0,0,0-28.45-18.12l-104,48.54A20.06,20.06,0,0,0,28,80.55V204H16a12,12,0,0,0,0,24H240a12,12,0,0,0,0-24ZM204,100V204H172V100ZM52,83.09,148,38.3V204H52ZM132,112v12a12,12,0,0,1-24,0V112a12,12,0,0,1,24,0Zm-40,0v12a12,12,0,0,1-24,0V112a12,12,0,0,1,24,0Zm0,52v12a12,12,0,0,1-24,0V164a12,12,0,0,1,24,0Zm40,0v12a12,12,0,0,1-24,0V164a12,12,0,0,1,24,0Z';

/**
 * A Unity organization, drawn as Unity's apps draw one, so people recognize it from the Unity Hub and the dashboard.
 * Sized as the Lucide icons beside it are, in `currentColor`.
 */
export function OrganizationIcon({ size = 16, ...rest }: OrganizationIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      <path d={BUILDING_PATH} />
    </svg>
  );
}
