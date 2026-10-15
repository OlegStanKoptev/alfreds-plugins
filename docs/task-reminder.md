# task-reminder: engine facts the design rests on

Working notes for whoever changes the mod. Each fact names how it was checked
and on which Claude Code build; recheck on a build that changes the hooks API.

## How 0.0.1 was checked

Headless runs of the app's 2.1.295 binary on `claude-opus-5-5`, as
`docs/smart-compact.md` describes, with `--plugin-dir plugins/task-reminder`,
`--debug-file` for the engine's log, and the options passed as
`--settings '{"pluginConfigs":{"task-reminder":{"options":{"marks":"1 2 3","every":1}}}}'`
(the values sit under `options`; a value put straight under the plugin's name
is ignored without a word). Read from the transcript files and the debug log:

- A `sleep` started with `run_in_background` answers with `backgroundTaskId`
  in the tool's record and no `timedOutAfterMs`; the mod's first reminder
  lands as `hook_additional_context` right after the result, in the main
  loop and in a subagent's alike.
- In an idle session each due reminder came at the first tick past its mark
  as a prompt of its own, "The task-reminder plugin sent a message:
  Reminder: …", with the toast, and the model answered it in a turn of its
  own. The debug log names the calls, `$.prompt.submit (task-reminder): …`
  and `$.ui.toast (task-reminder): …`, then "prompt.submit skipped:
  re-entry" for the mod's own hook, which the engine leaves out for the
  plugin's own prompt.
- Inside a running turn (a foreground `sleep 140` right after the
  backgrounding) the due reminder went in as a user row while the sleep ran,
  and the model read it with the sleep's result at its next request: "this
  reminder arrived afterwards and says … has run for 2 minutes". A turn
  inside one tool call reads nothing until that call returns.
- A background subagent's shell survives the subagent: its result carries no
  `backgroundEndsWithFinalResponse`. At the subagent's `turn.complete` the
  mod's note reached the idle main session as a prompt of its own, and the
  main session's `TaskStop <id>` on that shell answered "Successfully
  stopped task". The stop's notification then woke the background subagent
  too, so a background subagent's loop is not gone after its first turn.
- A completion notification passes `prompt.submit` with origin
  `task-notification` and the text `<task-notification>\n<task-id>…`; the
  tracking ended there in every run.

A reminder comes at the first tick past its mark, so up to a minute after
it: a mark missed by three seconds came as "has run for 2 minutes".

## An edit of the plugin folder reloads the mod inside every probe

The engine watches each `--plugin-dir` folder ("plugin-dir watch: watching
task-reminder" in the debug log): live at first, then, after about a minute
without a change, a poll every 30 seconds. A write there, a `touch`
included, reloads the mod in the running session: `register` runs again,
`session.start` is raised for the mod alone ("session.start: raised for
task-reminder (loaded later)"), the old environment's timers are gone,
`$.state` stays. Checked with a `touch` twenty seconds into a probe: the
ticks moved to the reload's cadence, none of the old one came, no reminder
doubled, the task stayed tracked, and the reminder due in that minute came
at the new timer's first tick.

That is what the first two probes ran into: a wording edit landed in the
minute where the 1-minute reminder was due, both sessions printed
"task-reminder: reloaded", the due tick never came and the next reminder
came a minute after the reload. The clean reruns had every reminder on
time. So the plugin folder is left alone, no edit, test or validate, while
a probe of it runs.

## What the validator holds a module to

`claude plugin validate` refuses a module that passes `$` to a function
that is not a top-level function declaration of the file: a `remind($, …)`
nested in `register` was refused with "$ is passed to "remind", which is not a
function declared at the top of this file". So the helpers that take `$` are
top-level functions, and what they share with `register` (whether the main
loop is in a turn, whether a pass is under way) is a module-level object.

## What the test kit answers for `$` calls

A test's hook on a `$`-call event (`fs.stat`, `fs.read`, `ui.toast`) answers
`{ value }` or `{ deny }`; a bare return is "returned neither { value } nor
{ deny }" and the hook is skipped. `mock.session(on)` registers the test's
one `session.append` hook, so a test that also hooks `session.append` itself
(to refuse an append to a gone subagent) records the rows in that hook and
leaves `mock.session` out. A `{ deny }` from a `session.append` hook comes
back to the plugin's `$.session.append` as a resolved `{ deny }`, while the
engine's own refusal (an `agentId` that names no running loop) rejects; the
mod treats both as "the loop is gone".
