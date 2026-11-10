import { Plus, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import type { BoundProjectsAnswer, IssueTrackerKind } from '@shared/domain/issueTrackers';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import { TextField } from '../../../ui/TextField';
import { addProjectReady, connectFailureWords, linkReadBack, type FailureWords } from './connectFlow';
import { SignInProblem } from './SignInProblem';
import { choiceOf, trackerChoiceCard } from './trackerChoices';
import { LinkReadBackLine } from './LinkReadBackLine';
import { projectRows, projectsExplained, projectsSectionWords } from './trackerCardContent';
import styles from './IssueTrackerPane.module.css';

interface ProjectsSectionProps {
  repository: string;
  kind: IssueTrackerKind;
  projects: readonly string[];
  answer: BoundProjectsAnswer | undefined;
}

/**
 * The bound projects (docs/features/issue-trackers.md, "Connecting"): what they're for, one row each with its name
 * and counts once read (`projectRows`), removable while another stays; "Add a project" under them, by a link to one
 * of its issues.
 */
export function ProjectsSection({ repository, kind, projects, answer }: ProjectsSectionProps) {
  const words = projectsSectionWords(kind);
  const rows = projectRows(projects, answer);
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{words.title}</h3>
      <p className={styles.intro}>{projectsExplained(kind, projects)}</p>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.project} className={styles.listRow}>
            <div className={styles.listText}>
              <span className={styles.key}>{row.label}</span>
              {row.name && <span className={styles.listName}>{row.name}</span>}
              {row.counts && <span className={styles.listDetail}>{row.counts}</span>}
            </div>
            {row.removeLabel && <IconButton className={styles.rowAction} size="small" icon={<X size={13} />} label={row.removeLabel} onClick={() => void api.issueTrackers.removeProject(repository, row.project)} />}
          </li>
        ))}
      </ul>
      <AddProject repository={repository} kind={kind} words={words} />
    </div>
  );
}

/**
 * "Add a project": a quiet button that opens a row of its own, a full-width field for a link to an issue of the
 * other project, read back as the user pastes, and Add or Cancel.
 */
function AddProject({ repository, kind, words }: { repository: string; kind: IssueTrackerKind; words: ReturnType<typeof projectsSectionWords> }) {
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<FailureWords | null>(null);
  const read = linkReadBack(link);
  const close = (): void => {
    setAdding(false);
    setLink('');
    setProblem(null);
  };
  if (!adding) {
    return (
      <div className={styles.row}>
        <Button size="small" variant="ghost" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
          {words.add}
        </Button>
      </div>
    );
  }
  const add = async (): Promise<void> => {
    setBusy(true);
    const outcome = await api.issueTrackers.addProject({ repository, link });
    setBusy(false);
    if (outcome.kind === 'signedIn') close();
    else setProblem(connectFailureWords(outcome.failure, { trackerName: TRACKER_GRAMMARS[kind].name }));
  };
  const keys = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
    if (event.key === 'Enter' && addProjectReady(link) && !busy) {
      event.preventDefault();
      void add();
    }
  };
  return (
    <div className={styles.next}>
      <TextField
        className={styles.field}
        label={words.fieldLabel}
        placeholder={trackerChoiceCard(choiceOf(kind)).placeholder}
        hint={words.fieldHint}
        value={link}
        onChange={(event) => {
          setLink(event.target.value);
          setProblem(null);
        }}
        onKeyDown={keys}
        autoFocus
      />
      {read.kind === 'read' && <LinkReadBackLine parts={read.parts} words={read.words} />}
      {read.kind === 'problem' && <p className={styles.problem}>{read.words}</p>}
      {problem && <SignInProblem failed={problem} />}
      <div className={styles.row}>
        <Button size="small" variant="primary" disabled={!addProjectReady(link)} loading={busy} onClick={() => void add()}>
          Add
        </Button>
        <Button size="small" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
