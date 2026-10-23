import buildings from '@phosphor-icons/core/bold/buildings-bold.svg?raw';
import type { SVGProps } from 'react';
import { svgPathOf } from '../lib/svgPath';

type OrganizationIconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Phosphor's Buildings (Bold), the icon Unity's apps draw for an organization, on its 256-unit grid. */
const BUILDINGS_PATH = svgPathOf(buildings);

/**
 * A Unity organization, drawn as Unity's apps draw one, so people recognize it from the Unity Hub and the dashboard.
 * Sized as the Lucide icons beside it are, in `currentColor`.
 */
export function OrganizationIcon({ size = 16, ...rest }: OrganizationIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      <path d={BUILDINGS_PATH} />
    </svg>
  );
}
