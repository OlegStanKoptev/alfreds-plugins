# task-reminder

**TL;DR:** a shell the agent left in the background is not forgotten: the
agent is reminded of it on a schedule, with the tail and age of its output,
until the task ends or the agent stops it.

## Install

```bash
claude plugin marketplace add zienag/alfreds-plugins
```

```bash
claude plugin install task-reminder@alfreds-plugins
```

## Why

A Bash call that runs past its timeout is moved to the background, and the
agent reads "You will be notified when it completes." That sounds like someone
else is watching. Nobody is: a hung process sends no completion, so the agent
re-runs the check another way and forgets the first one, which holds its lock
or its repository for hours.

This mod keeps the task in front of the agent. The tool result that moved the
shell to the background already says the task is the agent's and nobody else
watches it. Then, at 5, 10, 30, 60 and 120 minutes of run time and every two
hours after, a reminder names the task and its command, how long it has run,
when its output last changed and the output's last lines, and asks whether it
is still needed, with `TaskStop <id>` as the way out. A task still printing is
probably fine; one silent for forty minutes has probably hung, and the agent
can tell the two apart from the reminder alone.

A reminder reaches a running turn as a row the model reads at its next step,
so a session waiting on a long command gets it when that command returns. An
idle session is woken with the reminder as a prompt, and a toast says so.

A shell a subagent backgrounded is reminded in the subagent's loop. When the
subagent ends and the shell survives it, the main conversation is told at once
that the task is now its own, and the later reminders go there. A shell the
engine ends with the subagent is dropped when the subagent ends.

Tracking ends with the task's completion notification or a `TaskStop` of it.

## Options

- `marks`: when the reminders come, in minutes since the command started,
  e.g. `2 5 10 30 60 120`. A mark already past when the shell goes to the
  background is the note in that tool result.
- `every`: how often the reminders go on after the last mark, in minutes.

Run `claude plugin configure task-reminder@alfreds-plugins`.

## Working on it

`claude --plugin-dir plugins/task-reminder` loads the folder,
`claude plugin test plugins/task-reminder` runs the tests, and
[docs/task-reminder.md](../../docs/task-reminder.md) holds the engine facts
the design rests on.
