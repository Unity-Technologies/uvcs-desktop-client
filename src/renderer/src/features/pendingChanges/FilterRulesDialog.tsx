import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { TextArea } from '../../ui/TextField';
import { addRulesLabel, rulesFieldRows, rulesFromText } from './filterRulePatterns';
import styles from './FilterRulesDialog.module.css';

/**
 * Shows the rules a menu entry suggests for `fileName` (`ignore.conf`) and lets the user change them before they're
 * added. Resolves to the rules to add, or undefined if cancelled.
 */
export function askFilterRules(fileName: string, suggested: string[]): Promise<string[] | undefined> {
  return askDialog<string[]>((finish) => <FilterRulesDialog fileName={fileName} suggested={suggested} finish={finish} />);
}

function FilterRulesDialog({ fileName, suggested, finish }: { fileName: string; suggested: string[]; finish: (rules: string[] | undefined) => void }) {
  const [text, setText] = useState(suggested.join('\n'));
  const rules = rulesFromText(text);

  return (
    <Dialog
      title={`Add to ${fileName}`}
      description="One rule per line."
      width={480}
      onClose={() => finish(undefined)}
      onSubmit={() => rules.length > 0 && finish(rules)}
      footer={
        <>
          <Button onClick={() => finish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={rules.length === 0}>
            {addRulesLabel(rules.length)}
          </Button>
        </>
      }
    >
      <TextArea
        aria-label="Rules"
        className={styles.rules}
        value={text}
        rows={rulesFieldRows(suggested.length)}
        spellCheck={false}
        autoFocus
        onChange={(event) => setText(event.target.value)}
      />
    </Dialog>
  );
}
