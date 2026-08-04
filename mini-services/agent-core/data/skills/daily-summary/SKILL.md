---
name: daily-summary
description: Generate a structured daily business summary from recent activity. Use when the user asks for a "daily report", "what happened today", or "summarize my day".
version: 0.1.0
---

# Daily Summary Skill

When asked for a daily summary, follow this structure:

1. **Yesterday's loose ends** — check if there are unfinished tasks (look at recent shell history, git log, or ask the user).
2. **Today's wins** — list concrete accomplishments (files changed, commands run, commits made).
3. **Blockers** — anything that stalled progress.
4. **Tomorrow's priorities** — 3 concrete next steps.

Use `shell_exec` to gather data:
- `git log --since="1 day ago" --oneline` for commits
- `ls -lat | head -20` for recently modified files
- Check `~/.bash_history` tail for commands run

Format the summary in markdown. Be specific — quote actual commit messages, actual file names. Avoid generic platitudes.

End with: "Want me to save this as MEMORY.md entry?"
