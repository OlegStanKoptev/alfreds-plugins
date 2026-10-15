# caffeine

**TL;DR:** a home for behaviours that keep agents from falling asleep on work
they started. Two so far: the agent is reminded of every shell it left in the
background, and a subagent is held from ending its turn while a command it
started is still running.

## Install

```bash
claude plugin marketplace add zienag/alfreds-plugins
```

```bash
claude plugin install caffeine@alfreds-plugins
```

## Reminders of background shells

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

## The subagent hold

A subagent's ended turn is final: nothing resumes it. A subagent that starts a
command with `run_in_background` and ends its turn saying "waiting for the
notification" hands the one who called it an empty report, and the command's
completion reaches nobody.

When a subagent is about to end its turn, the mod looks at the commands it
started whose output does not yet end with the engine's exit line. If there
are any, the end is blocked once for them, with a reason that lists the commands, says that after the turn ends
nothing wakes a subagent, and asks it to wait for them in the foreground and
then finish its report. A command meant to outlive the subagent, a dev server,
is to be named in the report, after which the turn may end. The second end
passes, and a command still running then is handed to the main conversation as
described above. A command the engine ends together with the subagent counts
as running: it is the case where its result would be lost.

Where an organization manages Claude Code, the engine passes over the hook
of a plugin a person installs; the hold then needs the organization to list
caffeine in its managed settings.

## Reminder options

- `marks`: when the reminders come, in minutes since the command started,
  e.g. `2 5 10 30 60 120`. A mark already past when the shell goes to the
  background is the note in that tool result.
- `every`: how often the reminders go on after the last mark, in minutes.

Run `claude plugin configure caffeine@alfreds-plugins`.

## Working on it

`claude --plugin-dir plugins/caffeine` loads the folder,
`claude plugin test plugins/caffeine` runs the tests, and
[docs/caffeine.md](../../docs/caffeine.md) holds the engine facts
the design rests on.
