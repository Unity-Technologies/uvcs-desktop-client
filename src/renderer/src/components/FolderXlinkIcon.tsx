import { useId, type SVGProps } from 'react';

type FolderXlinkIconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Lucide's `Folder`, which `ItemIcon` draws for a directory, on its 24-unit grid: the xlink's folder is the same shape. */
const FOLDER_PATH = 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z';

/**
 * An xlink: the directory's solid folder, a circle cut from its bottom-right corner, and in it a badge of the same
 * color with an up-right arrow punched through. One color (`currentColor`) and real transparency, so the row's
 * background shows through the gap and the arrow on hover, selected and dark rows alike. Drawn at 16px, the 1.5x
 * grid keeps the gap and the arrow 1px wide. Each instance has its own mask ids: rows that reuse another's lose
 * their cutout when that row unmounts. The masks' white and black are what shows and what is cut, not colors.
 */
export function FolderXlinkIcon({ size = 16, ...rest }: FolderXlinkIconProps) {
  const id = useId().replace(/:/g, '');
  const folderMask = `xlink-folder-${id}`;
  const badgeMask = `xlink-badge-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      <defs>
        <mask id={folderMask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <circle cx="18" cy="18" r="6.375" fill="black" />
        </mask>
        <mask id={badgeMask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <path d="M16.125 19.875l3.75-3.75M17.25 16.125h2.625v2.625" fill="none" stroke="black" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </mask>
      </defs>
      <path mask={`url(#${folderMask})`} d={FOLDER_PATH} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle mask={`url(#${badgeMask})`} cx="18" cy="18" r="4.875" />
    </svg>
  );
}
