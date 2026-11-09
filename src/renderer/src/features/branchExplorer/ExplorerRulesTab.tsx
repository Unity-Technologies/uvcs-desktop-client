import { ArrowDown, ArrowUp, Filter, Pencil, Plus, Trash2 } from 'lucide-react';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { editExplorerRule } from './ExplorerRuleEditor';
import { HueDot } from './HueDot';
import { isFormatRule, newRule, type ExplorerRule } from './model/explorerRules';
import { ruleError } from './model/ruleMatches';
import {
  ADD_RULE_GROUPS,
  addingTurnsRulesOn,
  addRule,
  canMoveRule,
  moveRule,
  removeRule,
  replaceRule,
  RULE_KIND_LABELS,
  ruleRowDetail,
  ruleRowTitle,
  ruleTabBody,
} from './model/ruleList';
import { useRuleMatches } from './useRuleMatches';
import styles from './ExplorerRulesTab.module.css';

interface ExplorerRulesTabProps {
  rules: readonly ExplorerRule[];
  /** Off keeps the rules and applies none of them. */
  on: boolean;
  /** The rules the graph applies (none while they're off): only these ask the server, for their errors. */
  applied: readonly ExplorerRule[];
  onChange: (rules: ExplorerRule[]) => void;
  onTurn: (on: boolean) => void;
}

/** The display options' "Advanced filters & format" tab: the repository's inclusions, exclusions and formats. */
export function ExplorerRulesTab({ rules, on, applied, onChange, onTurn }: ExplorerRulesTabProps) {
  const matches = useRuleMatches(applied);
  const body = ruleTabBody(rules);
  const add = async (rule: ExplorerRule): Promise<void> => {
    const saved = await editExplorerRule(rule, true);
    if (!saved) return;
    onChange(addRule(rules, saved));
    if (addingTurnsRulesOn(rules, on)) onTurn(true);
  };
  const row = (rule: ExplorerRule) => (
    <RuleRow
      key={rule.id}
      rule={rule}
      error={ruleError(rule, matches)}
      canMoveUp={canMoveRule(rules, rule.id, -1)}
      canMoveDown={canMoveRule(rules, rule.id, 1)}
      onChange={(changed) => onChange(replaceRule(rules, changed))}
      onEdit={async () => {
        const saved = await editExplorerRule(rule, false);
        if (saved) onChange(replaceRule(rules, saved));
      }}
      onMove={(offset) => onChange(moveRule(rules, rule.id, offset))}
      onRemove={() => onChange(removeRule(rules, rule.id))}
    />
  );
  const addButton = (
    <AddRuleMenu onAdd={(kind) => void add(newRule(kind, crypto.randomUUID()))}>
      <Button size="small" icon={<Plus size={14} />}>
        Add rule
      </Button>
    </AddRuleMenu>
  );

  if (body.state === 'empty') {
    return (
      <EmptyState
        icon={<Filter size={20} />}
        title="No advanced filters or formats"
        description="Show or hide branches by a condition, and color the branches, changesets and labels it matches."
        action={addButton}
      />
    );
  }
  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <Checkbox label="Apply these rules" checked={on} onChange={onTurn} />
        {addButton}
      </div>
      {body.sections.map((section) => (
        <section key={section.title} className={styles.section} data-off={!on || undefined}>
          <h3 className={styles.heading}>{section.title}</h3>
          {section.note && <p className={styles.note}>{section.note}</p>}
          <ul className={styles.list}>{section.rules.map(row)}</ul>
        </section>
      ))}
    </div>
  );
}

function AddRuleMenu({ onAdd, children }: { onAdd: (kind: ExplorerRule['kind']) => void; children: React.ReactElement }) {
  const entries: MenuEntry[] = ADD_RULE_GROUPS.flatMap((group, index) => [
    ...(index > 0 ? [SEPARATOR] : []),
    ...group.map((kind) => ({ id: kind, label: RULE_KIND_LABELS[kind], run: () => onAdd(kind) })),
  ]);
  return (
    <ActionDropdownMenu entries={entries} align="start">
      {children}
    </ActionDropdownMenu>
  );
}

interface RuleRowProps {
  rule: ExplorerRule;
  error: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (rule: ExplorerRule) => void;
  onEdit: () => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}

function RuleRow({ rule, error, canMoveUp, canMoveDown, onChange, onEdit, onMove, onRemove }: RuleRowProps) {
  const title = ruleRowTitle(rule);
  const detail = ruleRowDetail(rule);
  return (
    <li className={styles.row} data-disabled={!rule.enabled || undefined}>
      <Checkbox ariaLabel={`Use ${title}`} checked={rule.enabled} onChange={(enabled) => onChange({ ...rule, enabled })} />
      {isFormatRule(rule) && <HueDot hue={rule.hue} size={10} />}
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {detail && (
          <span className={styles.detail} title={detail}>
            {detail}
          </span>
        )}
        {error && <span className={styles.error}>{error}</span>}
      </div>
      <div className={styles.actions}>
        {isFormatRule(rule) && (
          <>
            <IconButton icon={<ArrowUp size={14} />} label="Move up" size="small" disabled={!canMoveUp} onClick={() => onMove(-1)} />
            <IconButton icon={<ArrowDown size={14} />} label="Move down" size="small" disabled={!canMoveDown} onClick={() => onMove(1)} />
          </>
        )}
        <IconButton icon={<Pencil size={14} />} label="Edit" size="small" onClick={onEdit} />
        <IconButton icon={<Trash2 size={14} />} label="Delete" size="small" onClick={onRemove} />
      </div>
    </li>
  );
}
