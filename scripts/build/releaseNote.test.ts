import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPullRequestBody, misplacedPicture, readReleaseNote } from './releaseNote';

/** A pull request's body as the template leaves it, with `section` as its release note. */
const body = (section: string) =>
  `## What does this pull request do?\n\nShelves.\n\n## Release note\n\n<!-- Written with the release-notes skill. -->\n\n${section}\n\n## Current behavior\n\nNone.\n`;

describe('a release note', () => {
  it('reads its kind, title and description', () => {
    const section = '### New: Run your own tools on files and branches\n\nAdd them in **Settings › Tools**.\n\n![Tools](https://github.com/user-attachments/assets/1)';

    expect(readReleaseNote(body(section))).toEqual({
      note: {
        kind: 'New',
        title: 'Run your own tools on files and branches',
        description: 'Add them in **Settings › Tools**.\n\n![Tools](https://github.com/user-attachments/assets/1)',
      },
    });
  });

  it('reads every kind', () => {
    for (const kind of ['New', 'Improved', 'Fixed'] as const) {
      expect(readReleaseNote(body(`### ${kind}: A title\n\nA description.`))).toEqual({ note: { kind, title: 'A title', description: 'A description.' } });
    }
  });

  it('says why a pull request has none', () => {
    expect(readReleaseNote(body('None: moves code between services; nothing changes for users.'))).toEqual({
      note: { kind: 'none', reason: 'moves code between services; nothing changes for users.' },
    });
  });

  it('is the last section of the body too', () => {
    expect(readReleaseNote('## Release note\n\n### Fixed: Shelves open\n\nThey open again.')).toEqual({
      note: { kind: 'Fixed', title: 'Shelves open', description: 'They open again.' },
    });
  });

  it('reads a body written on Windows', () => {
    expect(readReleaseNote(body('### Fixed: Shelves open\n\nThey open again.').replace(/\n/g, '\r\n'))).toEqual({
      note: { kind: 'Fixed', title: 'Shelves open', description: 'They open again.' },
    });
  });

  it('keeps headings, code and tables in the description, even a "##" line inside code', () => {
    const description = '#### Where\n\nIn Settings.\n\n```md\n## Not a section\n```\n\n| Key | Does |\n| --- | --- |\n| ⌘I | Hides it |';

    expect(readReleaseNote(body(`### Improved: Hide the details panel\n\n${description}`))).toEqual({
      note: { kind: 'Improved', title: 'Hide the details panel', description },
    });
  });

  it('finds the section after code that only shows one', () => {
    const text = `## How it was implemented\n\n\`\`\`md\n## Release note\n\`\`\`\n\n${body('### Fixed: Shelves open\n\nThey open again.')}`;

    expect(readReleaseNote(text)).toEqual({ note: { kind: 'Fixed', title: 'Shelves open', description: 'They open again.' } });
  });

  it('keeps a code block written with tildes whole, backticks in it included', () => {
    const description = 'Type this:\n\n~~~\n```\n## Not a section\n~~~';

    expect(readReleaseNote(body(`### New: Code in comments\n\n${description}`))).toEqual({
      note: { kind: 'New', title: 'Code in comments', description },
    });
  });

  it('reads past comments, whatever they hold', () => {
    const section = '<!-- ## Not a section\n```\n-->\n### Fixed: Shelves open\n\nThey open again.';

    expect(readReleaseNote(body(section))).toEqual({ note: { kind: 'Fixed', title: 'Shelves open', description: 'They open again.' } });
  });

  it('keeps a rule and a heading of its own level and below', () => {
    const description = 'They open.\n\n---\n\n#### Where\n\nIn the Shelves view.';

    expect(readReleaseNote(body(`### Fixed: Shelves open\n\n${description}`))).toEqual({ note: { kind: 'Fixed', title: 'Shelves open', description } });
  });

  it('keeps the words of other languages and symbols', () => {
    expect(readReleaseNote(body('### Fixed: Árboles con ñ y 日本語 se abren\n\nYa se abren.'))).toEqual({
      note: { kind: 'Fixed', title: 'Árboles con ñ y 日本語 se abren', description: 'Ya se abren.' },
    });
  });
});

describe('a release note CI refuses', () => {
  const problem = (text: string) => {
    const reading = readReleaseNote(text);
    return 'problem' in reading ? reading.problem : null;
  };

  it('is missing', () => {
    expect(problem('## What does this pull request do?\n\nShelves.')).toMatch(/no "## Release note" section/);
    expect(problem('')).toMatch(/no "## Release note" section/);
  });

  it('is left as the template leaves it', () => {
    expect(problem(body(''))).toMatch(/empty/);
    expect(problem(readFileSync(join(__dirname, '..', '..', '.github', 'pull_request_template.md'), 'utf8'))).toMatch(/empty/);
  });

  it('has no kind, or one that is not New, Improved or Fixed', () => {
    expect(problem(body('### Run your own tools\n\nIn Settings.'))).toMatch(/New:, Improved: or Fixed:/);
    expect(problem(body('### Feature: Run your own tools\n\nIn Settings.'))).toMatch(/New:, Improved: or Fixed:/);
    expect(problem(body('Run your own tools in Settings.'))).toMatch(/New:, Improved: or Fixed:/);
  });

  it('writes its kind in other letters', () => {
    expect(problem(body('### new: Run your own tools\n\nIn Settings.'))).toMatch(/New:, Improved: or Fixed:/);
  });

  it("still holds the template's placeholders", () => {
    expect(problem(body('### New: <what users can now do>      (or Improved: / Fixed:)\n\nIn Settings.'))).toMatch(/template/);
    expect(problem(body('### New: Tools\n\n<A sentence or two: what it is, where to find it.>'))).toMatch(/template/);
    expect(problem(body('None: <why>'))).toMatch(/template/);
  });

  it('has a kind but no title', () => {
    expect(problem(body('### Fixed:\n\nThey open again.'))).toMatch(/title/);
  });

  it('has a title but no description', () => {
    expect(problem(body('### Fixed: Shelves open'))).toMatch(/description/);
  });

  it('holds a heading above the note\'s own level, which would read as a group of the release', () => {
    expect(problem(body('### Fixed: Shelves open\n\n# Why\n\nThey open.'))).toMatch(/####/);
    expect(problem(body('### Fixed: Shelves open\n\nWhy\n===\n\nThey open.'))).toMatch(/####/);
    expect(problem(body('### Fixed: Shelves open\n\nWhy\n---\n\nThey open.'))).toMatch(/####/);
  });

  it('leaves a code block open, which would swallow the rest of the release', () => {
    expect(problem(body('### Fixed: Shelves open\n\n```\ncm find\n``\n\nThey open.'))).toMatch(/code block/);
  });

  it('holds a second note', () => {
    expect(problem(body('### Fixed: Shelves open\n\nThey open.\n\n### New: Tools\n\nIn Settings.'))).toMatch(/one note/);
  });

  it('says there is none without saying why', () => {
    expect(problem(body('None:'))).toMatch(/why/);
    expect(problem(body('None'))).toMatch(/why/);
  });

  it('starts with "None" but is not "None:" and a reason', () => {
    expect(problem(body('None. '))).toMatch(/New:, Improved: or Fixed:/);
    expect(problem(body('None of the views flicker now.'))).toMatch(/New:, Improved: or Fixed:/);
  });

  it('says there is none, and holds a note or more than one paragraph', () => {
    expect(problem(body('None: tooling\n\n### New: Tools\n\nIn Settings.'))).toMatch(/one line/);
    expect(problem(body('None: tooling\n\nAnd more.'))).toMatch(/one line/);
  });
});

/** A body shaped like an agent's: every section of the template, then the closing line. */
const pullRequest = ({ note = '', behavior = '', fixedIssues = 'None.', after = '' } = {}) =>
  [
    '## What does this pull request do?\n\nMove branches up and down.',
    `## Release note\n\n### New: Move branches up and down in the Branch Explorer\n\nRight-click a branch and choose **Position**.${note}`,
    '## Current behavior\n\nThe Branch Explorer chooses every row.',
    `## Behavior with this pull request\n\nA branch's menu has a **Position** submenu.${behavior}`,
    '## Checklist\n\n- [x] `npm test` passes.',
    `## Fixed issues\n\n${fixedIssues}`,
    `🤖 Generated with [Claude Code](https://claude.com/claude-code)${after}`,
  ].join('\n\n') + '\n';

const cropped = '\n\n![The Position submenu](https://github.com/user-attachments/assets/1)';
const wide = '\n\n![The Branch Explorer with a branch moved](https://github.com/user-attachments/assets/2)';

describe("a pull request's pictures", () => {
  it('may be none, for a change nobody sees', () => {
    expect(misplacedPicture(pullRequest())).toBeNull();
  });

  it('sit in the release note, cropped to the feature', () => {
    expect(misplacedPicture(pullRequest({ note: cropped }))).toBeNull();
  });

  it("may add a wider one for reviewers beside the note's", () => {
    expect(misplacedPicture(pullRequest({ note: cropped, behavior: wide }))).toBeNull();
  });

  it('are refused when only the reviewers get one', () => {
    expect(misplacedPicture(pullRequest({ behavior: wide }))).toMatch(/release note has none/);
  });

  it("are refused after the closing line, where gh appends an attachment the body doesn't reference", () => {
    expect(misplacedPicture(pullRequest({ after: `\n${wide}` }))).toMatch(/end of the body/);
    expect(misplacedPicture(pullRequest({ note: cropped, after: `\n${wide}` }))).toMatch(/end of the body/);
  });

  it('are refused in the last section, where a body without a closing line ends', () => {
    expect(misplacedPicture(pullRequest({ note: cropped, fixedIssues: `None.${wide}` }))).toMatch(/end of the body/);
  });

  it("count an HTML picture, as GitHub's editor writes one", () => {
    const html = '\n\n<img width="800" alt="The Branch Explorer" src="https://github.com/user-attachments/assets/2" />';

    expect(misplacedPicture(pullRequest({ behavior: html }))).toMatch(/release note has none/);
  });

  it('ignore pictures in comments and code, as the template shows them', () => {
    const shown = '\n\n<!-- ![What it shows](./shot.png) -->\n\n```md\n![What it shows](./shot.png)\n```';

    expect(misplacedPicture(pullRequest({ behavior: shown, after: shown }))).toBeNull();
  });

  it('read a body written on Windows', () => {
    expect(misplacedPicture(pullRequest({ after: `\n${wide}` }).replace(/\n/g, '\r\n'))).toMatch(/end of the body/);
  });

  it("are checked once the note reads, so the note's own problem comes first", () => {
    expect(checkPullRequestBody(pullRequest({ behavior: wide }))).toEqual({ problem: expect.stringMatching(/release note has none/) });
    expect(checkPullRequestBody(`## Release note\n\n### Feature: Positions\n\nMove branches.\n\n## Behavior${wide}`)).toEqual({
      problem: expect.stringMatching(/New:, Improved: or Fixed:/),
    });
    expect(checkPullRequestBody(pullRequest({ note: cropped }))).toEqual({
      note: expect.objectContaining({ kind: 'New', title: 'Move branches up and down in the Branch Explorer' }),
    });
  });
});
