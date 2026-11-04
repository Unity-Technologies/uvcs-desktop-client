import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, CircleDot, ClipboardList, Eye, List, ListTree } from 'lucide-react';
import { useContext, type ReactNode } from 'react';
import type { Icon } from '../lib/actions';
import { Button } from '../ui/Button';
import { focusAfterMenu } from '../ui/menu/focusAfterMenu';
import menuStyles from '../ui/menu/Menu.module.css';
import { fileListViewMenu, type FileListGrouping, type FileListViewOffer } from './fileListViewMenuModel';
import { useFileListViewStore, type FileListLayout } from './fileListViewStore';
import { FileTreeFoldingContext } from './fileTreeFolding';
import styles from './FileListViewMenu.module.css';

const LAYOUT_ICONS: Record<FileListLayout, Icon> = { list: List, tree: ListTree };
const GROUPING_ICONS: Record<FileListGrouping, Icon> = { changelist: ClipboardList, status: CircleDot };

interface FileListViewMenuProps {
  /** What the list offers beyond layout and sort: its groupings. */
  offer: FileListViewOffer;
  /** Changes' grouping by changelist turned on or off; only with `offer.changelists`. */
  onChangelistsChange?: (on: boolean) => void;
}

/**
 * How the files of every list of changed files show, chosen in any of them: List or Tree, grouped by status (and by
 * changelist in Changes), sorted, and every group and folder closed or opened at once. One button: chosen once and
 * kept, it takes the room of one in every filter bar. Choices apply at once with the menu still open, so the list
 * behind it shows each; Esc or a click away closes it. The button is an eye, as it holds the whole view (layout,
 * groups, sort, folding), not only the layout, and its tooltip names that view.
 */
export function FileListViewMenu({ offer, onChangelistsChange }: FileListViewMenuProps) {
  const view = useFileListViewStore();
  const folding = useContext(FileTreeFoldingContext);
  const menu = fileListViewMenu(view, offer);
  const setGrouping = (grouping: FileListGrouping, on: boolean): void => {
    if (grouping === 'status') view.setGroupByStatus(on);
    else onChangelistsChange?.(on);
  };
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="small" className={styles.trigger} icon={<Eye size={14} />} aria-label={menu.summary} data-tip={menu.summary}>
          <ChevronDown size={11} className={styles.chevron} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={`${menuStyles.content} ${styles.content}`}
          align="end"
          sideOffset={4}
          onCloseAutoFocus={(event) => focusAfterMenu(event)}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Section title="Layout">
            <DropdownMenu.RadioGroup value={menu.layout} onValueChange={(layout) => view.setLayout(layout as FileListLayout)}>
              {menu.layouts.map((layout) => (
                <Choice key={layout.value} value={layout.value} icon={LAYOUT_ICONS[layout.value]} label={layout.label} checked={layout.value === menu.layout} />
              ))}
            </DropdownMenu.RadioGroup>
          </Section>
          {menu.groupings.length > 0 && (
            <Section title="Group by">
              {menu.groupings.map((grouping) => {
                const GroupingIcon = GROUPING_ICONS[grouping.value];
                return (
                  <DropdownMenu.CheckboxItem
                    key={grouping.value}
                    className={menuStyles.item}
                    checked={grouping.on}
                    onCheckedChange={(on) => setGrouping(grouping.value, on)}
                    onSelect={keepOpen}
                  >
                    <span className={menuStyles.icon}>
                      <GroupingIcon size={14} />
                    </span>
                    <span className={menuStyles.label}>{grouping.label}</span>
                    <Mark shown={grouping.on} />
                  </DropdownMenu.CheckboxItem>
                );
              })}
            </Section>
          )}
          <Section title="Sort by">
            <DropdownMenu.RadioGroup value={menu.sort} onValueChange={(sort) => view.setSort(sort as typeof menu.sort)}>
              {menu.sorts.map((sort) => (
                <Choice key={sort.value} value={sort.value} label={sort.label} checked={sort.value === menu.sort} />
              ))}
            </DropdownMenu.RadioGroup>
          </Section>
          {folding && (
            <>
              <DropdownMenu.Separator className={menuStyles.separator} />
              <DropdownMenu.Item className={menuStyles.item} onSelect={() => (folding.anyOpen ? folding.collapseAll() : folding.expandAll())}>
                <span className={menuStyles.icon}>{folding.anyOpen ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}</span>
                <span className={menuStyles.label}>{folding.anyOpen ? 'Collapse all' : 'Expand all'}</span>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** A choice applies with the menu open, so the list behind it shows the outcome. */
const keepOpen = (event: Event): void => event.preventDefault();

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <DropdownMenu.Group className={styles.section}>
      <DropdownMenu.Label className={styles.title}>{title}</DropdownMenu.Label>
      {children}
    </DropdownMenu.Group>
  );
}

function Choice({ value, icon: ChoiceIcon, label, checked }: { value: string; icon?: Icon; label: string; checked: boolean }) {
  return (
    <DropdownMenu.RadioItem className={menuStyles.item} value={value} onSelect={keepOpen}>
      {/* Always there, empty for a sort, so every label of the menu starts in the same column. */}
      <span className={menuStyles.icon}>{ChoiceIcon && <ChoiceIcon size={14} />}</span>
      <span className={menuStyles.label}>{label}</span>
      <Mark shown={checked} />
    </DropdownMenu.RadioItem>
  );
}

/** The choice made, after its label, as every menu marks it. */
function Mark({ shown }: { shown: boolean }) {
  return <span className={menuStyles.check}>{shown ? <Check size={14} /> : <span className={styles.noMark} />}</span>;
}
