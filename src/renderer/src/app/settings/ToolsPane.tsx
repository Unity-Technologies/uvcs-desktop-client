import { MoreHorizontal, Plus } from 'lucide-react';
import type { Tool } from '@shared/domain/tools';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { openToolDialog } from './ToolDialog';
import { toolRowMenu, toolRows } from './toolSettings';
import { SettingsGroup } from './SettingsGroup';
import { saveSettings, useSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

/** The user's tools, in the order their menus show them (docs/features/tools.md). */
export function ToolsPane() {
  const { tools } = useSettings();
  const saveTools = (changed: Tool[]): Promise<void> => saveSettings({ tools: changed });
  const withTool = (tool: Tool): Promise<void> =>
    saveTools(tools.some((saved) => saved.id === tool.id) ? tools.map((saved) => (saved.id === tool.id ? tool : saved)) : [...tools, tool]);
  const edit = (tool: Tool) => () => openToolDialog(tool, withTool);

  return (
    <>
      <p className={styles.note}>
        Programs you run on what you select, from its menu&apos;s Tools: a script that posts a changeset, a build of a branch, an upload of a file. Each
        runs only when you pick it.
      </p>
      <SettingsGroup title="Tools">
        {tools.length > 0 && (
          <div className={styles.rulesFrame}>
            <div className={styles.rules} role="list" aria-label="Tools">
              {toolRows(tools).map((row, index) => (
                <div key={row.id} className={styles.rule} role="listitem">
                  <button type="button" className={styles.ruleMain} onClick={edit(tools[index]!)} aria-label={`Edit ${row.name}`}>
                    <span className={styles.oneLine}>{row.name}</span>
                    <span className={`${styles.ruleToolDetail} ${styles.oneLine}`}>{row.runsOn}</span>
                  </button>
                  <ActionDropdownMenu entries={toolRowMenu(tools, row.id, edit(tools[index]!), (changed) => void saveTools(changed), () => `tool:${crypto.randomUUID()}`)}>
                    <IconButton size="small" className={styles.ruleMenu} icon={<MoreHorizontal size={14} />} label={`More for ${row.name}`} />
                  </ActionDropdownMenu>
                </div>
              ))}
            </div>
          </div>
        )}
        <Button size="small" icon={<Plus size={13} />} onClick={() => openToolDialog(null, withTool)}>
          Add a tool
        </Button>
      </SettingsGroup>
    </>
  );
}
