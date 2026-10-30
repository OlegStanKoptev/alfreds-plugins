---
name: t3-caffeine
description: Track unfinished work and use T3 lifecycle notifications across providers, without Claude hooks.
---

Honor the host's task lifecycle. T3 delegates: follow returned next; do not poll them. PR checks: use the host's PR watch tools when authorized. Provider shell processes: use that provider's supported resume/wait tool; never assume Bash, TaskStop, or a Claude task ID exists.

The bridge CLI described in ../../README.md can persist metadata for unfinished work. Use the actual T3 thread ID as session. After starting a task, track its real task ID and description. Before a task boundary, due returns reminders for recorded tasks; it does not inspect or poll the tasks. Check their state only using an authorized host mechanism. Call finish only after completion or confirmed cancellation. Before ending, report outstanding work or use the host's authorized handoff mechanism.

This is cooperative tracking: there is no timer, unsolicited prompt injection, stop hook, or guarantee that a provider shell survives the caller. Never promise automatic wakeups. Never keep a turn alive with sleeps or busy polling. If a host notification exists, prefer it over the bridge. Do not record credentials or command output in task descriptions.
