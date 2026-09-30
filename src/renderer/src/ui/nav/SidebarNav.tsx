import * as Popover from '@radix-ui/react-popover';
import { MoreHorizontal } from 'lucide-react';
import { createContext, useContext, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type Ref } from 'react';
import { shownItemCount, type NavLayout } from './navOverflow';
import { navBadgeText } from './navBadgeText';
import { navItemTip } from './navItemTip';
import styles from './SidebarNav.module.css';

const RailContext = createContext(false);

/** Whether the sidebar around shows as its rail: each item a tile, its icon over its label in small type. */
export function useInRail(): boolean {
  return useContext(RailContext);
}

interface SidebarProps {
  children: ReactNode;
  width?: number;
  /** Folded into a narrow rail of tiles. */
  rail?: boolean;
}

/** The column that holds an app sidebar, under the window's top bar. The rail's width is its CSS's. */
export function Sidebar({ children, width = 216, rail = false }: SidebarProps) {
  return (
    <nav className={styles.sidebar} data-rail={rail} style={{ width: rail ? undefined : width }}>
      <RailContext.Provider value={rail}>{children}</RailContext.Provider>
    </nav>
  );
}

interface NavItemProps {
  icon: ReactNode;
  /** Its name, shown and read as it; the tooltip and screen readers keep it whole when the rail shortens it. */
  label: string;
  /** Shown instead of the label on the rail's tile, where room is short ("Expand" for "Expand sidebar"). */
  railLabel?: string;
  /** Quiet text at the right, e.g. "Cloud". */
  detail?: string;
  /** A count at the right, e.g. pending changes. */
  badge?: number;
  /**
   * A dot at the right, saying what waits there ("Changes left on /main/task · restore them in Changes"): the words
   * show under the item's tooltip and are read with it.
   */
  dot?: string;
  active?: boolean;
  /** Active, but a page is open on top of it. */
  dimmed?: boolean;
  /** Shown with its label as a tooltip. */
  shortcut?: string;
  onClick?: () => void;
  /** What a popover's trigger adds to it (More): its ref, state and ARIA attributes. */
  ref?: Ref<HTMLButtonElement>;
}

export function NavItem(props: NavItemProps) {
  const { icon, label, railLabel, detail, badge, dot, active = false, dimmed = false, shortcut, onClick, ...trigger } = props;
  const rail = useInRail();
  const tip = navItemTip({ label, railLabel, detail, badge, dot, shortcut }, rail);
  const shownLabel = rail && railLabel ? railLabel : label;

  return (
    <button
      type="button"
      className={styles.item}
      data-active={active}
      data-dimmed={dimmed}
      aria-current={active ? 'page' : undefined}
      data-tip={tip}
      data-tip-sub={dot}
      data-tip-shortcut={shortcut}
      aria-label={shownLabel === label ? undefined : label}
      aria-description={dot}
      onClick={onClick}
      {...trigger}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{shownLabel}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
      {dot && <span className={styles.dot} />}
      {badge ? <span className={styles.badge}>{navBadgeText(badge, rail)}</span> : null}
    </button>
  );
}

/** Pushes what follows to the bottom of the sidebar. */
export function NavFooter({ children }: { children: ReactNode }) {
  return <div className={styles.footer}>{children}</div>;
}

/** One of a sidebar's groups: its title and its items, each an element that renders a `NavItem`. */
export interface NavSection {
  label?: string;
  items: NavSectionItem[];
}

export interface NavSectionItem {
  key: string;
  element: ReactNode;
  /** Its item is the one selected: More looks selected while it lists it. */
  active?: boolean;
}

/**
 * The sidebar's groups, as many of their items as fit and a More item after them listing the rest in a popover
 * (`shownItemCount`): no scrollbar, which the rail couldn't show, and nothing out of sight. It measures its items as
 * they are (a tile's label may take two lines) whenever its size changes; the items it moves into More stay laid out,
 * out of sight, so they're measured too.
 */
export function NavGroups({ sections }: { sections: NavSection[] }) {
  const rail = useInRail();
  const containerRef = useRef<HTMLDivElement>(null);
  const total = sections.reduce((count, section) => count + section.items.length, 0);
  const [shown, setShown] = useState(total);
  // Measured again when the items or the rail change, not on every render: the parents rebuild `sections` each time.
  const itemKeys = sections.flatMap((section) => section.items.map((item) => item.key)).join('\n');

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = (): void => setShown(shownItemCount(measuredLayout(container), container.clientHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [itemKeys, rail]);

  const hidden = hiddenSections(sections, shown);
  const moreSection = moreSectionIndex(sections, shown);
  let before = 0;

  return (
    <div ref={containerRef} className={styles.groups}>
      {sections.map((section, index) => {
        const first = before;
        before += section.items.length;
        const showsItems = first < shown;
        return (
          <div key={section.label ?? index} className={styles.group} data-nav-group data-hidden={!showsItems && index !== moreSection}>
            {section.label && (
              <div className={styles.groupLabel} data-nav-label data-hidden={!showsItems}>
                {section.label}
              </div>
            )}
            {section.items.map((item, position) => (
              <div key={item.key} className={styles.slot} data-nav-slot data-hidden={first + position >= shown} inert={first + position >= shown}>
                {item.element}
              </div>
            ))}
            {index === moreSection && <MoreItem sections={hidden} needed={shown < total} />}
          </div>
        );
      })}
    </div>
  );
}

/** The More item and its popover, listing the items that don't fit under their groups' titles; laid out even unneeded, to be measured. */
function MoreItem({ sections, needed }: { sections: NavSection[]; needed: boolean }) {
  const [open, setOpen] = useState(false);
  const active = sections.some((section) => section.items.some((item) => item.active));
  // Choosing one of its items closes it.
  const closeOnItem = (event: MouseEvent): void => {
    if (event.target instanceof Element && event.target.closest('button')) setOpen(false);
  };

  return (
    <div className={styles.slot} data-nav-more data-hidden={!needed} inert={!needed}>
      <Popover.Root open={open && needed} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <NavItem icon={<MoreHorizontal size={15} />} label="More" active={active} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className={styles.morePopover} side="right" align="end" sideOffset={6} collisionPadding={8} onClick={closeOnItem}>
            <RailContext.Provider value={false}>
              {sections.map((section, index) => (
                <div key={section.label ?? index} className={styles.group}>
                  {section.label && <div className={styles.groupLabel}>{section.label}</div>}
                  {section.items.map((item) => (
                    <div key={item.key}>{item.element}</div>
                  ))}
                </div>
              ))}
            </RailContext.Provider>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

/** The group More goes in: the one of the last item that shows (the first when none does). */
function moreSectionIndex(sections: NavSection[], shown: number): number {
  let before = 0;
  for (const [index, section] of sections.entries()) {
    before += section.items.length;
    if (before >= shown) return index;
  }
  return sections.length - 1;
}

/** The items past the first `shown`, under their groups' titles. */
function hiddenSections(sections: NavSection[], shown: number): NavSection[] {
  let before = 0;
  return sections.flatMap((section) => {
    const first = before;
    before += section.items.length;
    const items = section.items.filter((_, position) => first + position >= shown);
    return items.length > 0 ? [{ ...section, items }] : [];
  });
}

/** The heights `shownItemCount` needs, read from the laid-out groups (every item laid out, shown or not). */
function measuredLayout(container: HTMLElement): NavLayout {
  const groups = [...container.querySelectorAll<HTMLElement>('[data-nav-group]')];
  const gapOf = (element: Element | undefined): number => (element ? parseFloat(getComputedStyle(element).rowGap) || 0 : 0);
  return {
    groups: groups.map((group) => ({
      labelHeight: group.querySelector<HTMLElement>('[data-nav-label]')?.offsetHeight ?? 0,
      itemHeights: [...group.querySelectorAll<HTMLElement>('[data-nav-slot]')].map((slot) => slot.offsetHeight),
    })),
    groupGap: gapOf(container),
    itemGap: gapOf(groups[0]),
    moreHeight: container.querySelector<HTMLElement>('[data-nav-more]')?.offsetHeight ?? 0,
  };
}
