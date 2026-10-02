import type { ExternalApp } from '@shared/domain/externalApps';
import type { Icon } from '../../lib/actions';

const icons = new Map<string, Icon>();

/**
 * The app's own icon, drawn where menus and settings draw theirs; one component per picture, so a menu built again
 * keeps it. None when the OS gave none.
 */
export function appIcon(app: ExternalApp): Icon | undefined {
  if (!app.icon) return undefined;
  const src = app.icon;
  let icon = icons.get(src);
  if (!icon) {
    icon = ({ size = 16, className }) => <img src={src} width={size} height={size} className={className} alt="" draggable={false} />;
    icons.set(src, icon);
  }
  return icon;
}
