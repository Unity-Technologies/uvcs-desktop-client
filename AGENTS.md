# Agents

Every agent working in this repository, whatever the tool, follows **[CLAUDE.md](CLAUDE.md)**: read it in full before
changing anything. It holds the rules, the commands, the definition of done and how work is delivered (a reviewed pull
request, never a merge into `main`). Despite its name it isn't specific to Claude Code; this file exists so tools that
read `AGENTS.md` find it.

What lives under `.claude/` is plain Markdown any agent can use:

- **Skills** (`.claude/skills/<name>/SKILL.md`): instructions for a tool or library. When CLAUDE.md says to use a
  skill (`playwright-cli`, `pierre-diffs`), read its `SKILL.md` and follow it.
- **The reviewer** (`.claude/agents/reviewer.md`): the brief for the clean-context review every branch gets before
  its pull request ("Delivering work: a pull request" in CLAUDE.md). Give it to a fresh agent or session, one that
  didn't write the change, along with the branch and what the change is for.
